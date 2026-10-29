import asyncio
from typing import Any

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.base_schema import AuthSchema, BatchSetAvailable, PageResultSchema
from app.core.exceptions import CustomException
from app.core.logger import logger
from app.modules.system.dict.service import DictService
from app.utils.common_util import search_to_dict
from app.utils.excel_dict import ExcelDictConfig, ExcelDictSnapshot
from app.utils.excel_util import ExcelUtil

from .crud import TestDemoBaseCRUD
from .schema import (
    TestDemoBaseCreateSchema,
    TestDemoBaseOutSchema,
    TestDemoBaseQueryParam,
    TestDemoBaseUpdateSchema,
)

EXCEL_DICTS = {"user_sex": ExcelDictConfig("sys_user_sex", code_type=int)}


class TestDemoBaseService:
    """基础测试管理模块服务层"""

    def __init__(self, auth: AuthSchema, db: AsyncSession) -> None:
        self.auth = auth
        self.db = db

    async def detail(self, id: int) -> TestDemoBaseOutSchema:
        obj = await TestDemoBaseCRUD(self.auth, self.db).get(id=id)
        if not obj:
            raise CustomException(msg="该数据不存在")
        return TestDemoBaseOutSchema.model_validate(obj)

    async def get_list(
        self,
        search: TestDemoBaseQueryParam | None = None,
        order_by: list[dict[str, str]] | None = None,
    ) -> list[TestDemoBaseOutSchema]:
        obj_list = await TestDemoBaseCRUD(self.auth, self.db).get_list(search=search_to_dict(search), order_by=order_by)
        return [TestDemoBaseOutSchema.model_validate(obj) for obj in obj_list]

    async def page(
        self,
        page_no: int,
        page_size: int,
        search: TestDemoBaseQueryParam | None = None,
        order_by: list[dict[str, str]] | None = None,
    ) -> PageResultSchema[TestDemoBaseOutSchema]:
        offset = (page_no - 1) * page_size
        return await TestDemoBaseCRUD(self.auth, self.db).page(
            offset=offset,
            limit=page_size,
            order_by=order_by or [{"uuid": "asc"}],
            search=search_to_dict(search, {}),
            out_schema=TestDemoBaseOutSchema,
        )

    async def create(self, data: TestDemoBaseCreateSchema) -> TestDemoBaseOutSchema:
        obj = await TestDemoBaseCRUD(self.auth, self.db).create(data=data)
        return TestDemoBaseOutSchema.model_validate(obj)

    async def update(self, id: int, data: TestDemoBaseUpdateSchema) -> TestDemoBaseOutSchema:
        obj = await TestDemoBaseCRUD(self.auth, self.db).get(id=id)
        if not obj:
            raise CustomException(msg="更新失败，该数据不存在")

        obj = await TestDemoBaseCRUD(self.auth, self.db).update(id=id, data=data)
        return TestDemoBaseOutSchema.model_validate(obj)

    async def delete(self, ids: list[int]) -> None:
        if not ids:
            raise CustomException(msg="删除失败，删除对象不能为空")
        objs = await TestDemoBaseCRUD(self.auth, self.db).get_list(search={"uuid": ("in", ids)})
        obj_map = {o.uuid: o for o in objs}
        for id_ in ids:
            if id_ not in obj_map:
                raise CustomException(msg="删除失败，该数据不存在")
        await TestDemoBaseCRUD(self.auth, self.db).delete(ids=ids)

    async def set_available(self, data: BatchSetAvailable) -> None:
        await TestDemoBaseCRUD(self.auth, self.db).set(ids=data.ids, status=data.status)

    async def batch_export(self, obj_list: list[dict[str, Any]]) -> bytes:
        mapping_dict = {
            "created_time": "创建时间",
            "updated_time": "更新时间",
            "created_id": "创建人ID",
            "user_name": "用户名",
            "user_sex": "性别",
        }

        data = [dict(item) for item in obj_list]
        for item in data:
            creator_info = item.get("created_id")
            if isinstance(creator_info, dict):
                item["created_id"] = creator_info.get("name", "未知")
            else:
                item["created_id"] = "未知"

        dictionary = await ExcelDictSnapshot.load(DictService(self.auth, self.db), EXCEL_DICTS)
        return await ExcelUtil.aexport_list2excel(list_data=data, mapping_dict=mapping_dict, dictionary=dictionary)

    async def batch_import(self, file: UploadFile, update_support: bool = False) -> str:
        header_dict = {
            "用户名": "user_name",
            "性别": "user_sex",
        }

        try:
            try:
                contents = await file.read()
            finally:
                await file.close()
            dictionary = await ExcelDictSnapshot.load(DictService(self.auth, self.db), EXCEL_DICTS, importing=True)
            try:
                rows = await ExcelUtil.aread_excel_to_dicts(contents, dictionary=dictionary, header_mapping=header_dict)
            except ValueError as exc:
                raise CustomException(msg=str(exc)) from exc

            if not rows:
                raise CustomException(msg="导入文件为空")

            missing_headers = [h for h, field in header_dict.items() if field not in rows[0]]
            if missing_headers:
                raise CustomException(msg=f"导入文件缺少必要的列: {', '.join(missing_headers)}")

            # 将中文字段名映射为英文字段
            mapped_rows = []
            for row in rows:
                mapped_rows.append(row)

            required_fields = []
            errors = []
            for field in required_fields:
                missing_indices = [i + 1 for i, r in enumerate(mapped_rows) if r.get(field) is None]
                if missing_indices:
                    field_name = next((k for k, v in header_dict.items() if v == field), field)
                    rows_str = "、".join(str(i) for i in missing_indices)
                    errors.append(f"{field_name}不能为空，第{rows_str}行")
            if errors:
                raise CustomException(msg=f"导入失败，以下行缺少必要字段：\n{'; '.join(errors)}")

            error_msgs = []
            success_count = 0

            for i, row in enumerate(mapped_rows, start=1):
                try:
                    create_schema = TestDemoBaseCreateSchema.model_validate(row)

                    await TestDemoBaseCRUD(self.auth, self.db).create(data=create_schema)
                    success_count += 1
                except Exception as e:
                    error_msgs.append(f"第{i}行: {e!s}")
                    continue

            result = f"成功导入 {success_count} 条数据"
            if error_msgs:
                result += "\n错误信息:\n" + "\n".join(error_msgs)
            return result

        except CustomException:
            raise
        except Exception as e:
            logger.error(f"批量导入失败: {e!s}")
            raise CustomException(msg=f"导入失败: {e!s}")

    async def import_template_download(self) -> bytes:
        mapping = {"user_name": "用户名", "user_sex": "性别"}
        dictionary = await ExcelDictSnapshot.load(DictService(self.auth, self.db), EXCEL_DICTS, importing=True)
        return await asyncio.to_thread(ExcelUtil.get_excel_template, list(mapping.values()), [], [], dictionary=dictionary, mapping_dict=mapping)
