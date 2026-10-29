"""Import acknowledgements must follow commit, and audit logs must still run."""

from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI, Request
from sqlalchemy import Column, Integer, MetaData, Table, insert, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config.setting import settings
from app.core import router_class
from app.core.base_schema import AuthSchema
from app.core.dependencies import db_getter, get_current_user
from app.modules.system.user.controller import UserRouter
from app.modules.system.user.service import UserService
from app.plugin.module_demo.test_demo_base.controller import TestDemoBaseRouter as BaseDemoRouter
from app.plugin.module_demo.test_demo_base.service import TestDemoBaseService as BaseDemoService
from app.plugin.module_example.demo.controller import DemoRouter
from app.plugin.module_example.demo.service import DemoService


@pytest.mark.parametrize(
    "router,service,path", [(UserRouter, UserService, "/user/import/data"), (DemoRouter, DemoService, "/demo/import"), (BaseDemoRouter, BaseDemoService, "/test_demo_base/import")]
)
@pytest.mark.parametrize("commit_succeeds", [True, False])
async def test_import_commits_before_success_and_preserves_audit(monkeypatch, router, service, path, commit_succeeds):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine)
    table = Table("imported", MetaData(), Column("id", Integer, primary_key=True))
    async with engine.begin() as conn:
        await conn.run_sync(table.create)
    events = []

    async def db_dependency(request: Request):
        async with factory() as db:
            request.state.database_session = db
            async with db.begin():
                yield db
                if not commit_succeeds:
                    raise RuntimeError("simulated commit failure")
            events.append("commit")
            for callback in db.info.pop("after_commit_callbacks", {}).values():
                await callback()

    async def auth_dependency():
        auth = AuthSchema()
        auth.user.is_superuser = True
        return auth

    async def import_data(self, file, update_support=False):
        await self.db.execute(insert(table).values(id=1))
        return "成功导入 1 条数据"

    async def audit(_data):
        assert events[0] == "commit"
        async with factory() as db:
            assert (await db.execute(select(table.c.id))).scalar_one() == 1
        events.append("audit")

    monkeypatch.setattr(service, "batch_import", import_data)
    monkeypatch.setattr(settings, "OPERATION_RECORD_METHOD", ["POST"])
    writer = AsyncMock(side_effect=audit)
    monkeypatch.setattr(router_class, "_write_operation_log_async", writer)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[db_getter] = db_dependency
    app.dependency_overrides[get_current_user] = auth_dependency

    async def observed_app(scope, receive, send):
        async def observed_send(message):
            if message["type"] == "http.response.start":
                assert ("commit" in events) == commit_succeeds
                events.append("response")
            await send(message)

        await app(scope, receive, observed_send)

    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=observed_app, raise_app_exceptions=False), base_url="http://test") as client:
            result = await client.post(path, files={"file": ("probe.xlsx", b"test")})
        if commit_succeeds:
            assert result.status_code == 200
            assert result.json()["data"] == "成功导入 1 条数据"
            assert events == ["commit", "audit", "response"]
            writer.assert_awaited_once()
        else:
            assert result.status_code == 500
            assert events == ["response"]
            writer.assert_not_awaited()
            async with factory() as db:
                assert (await db.execute(select(table.c.id))).scalars().all() == []
    finally:
        await engine.dispose()
