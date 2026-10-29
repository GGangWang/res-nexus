import urllib.parse
from typing import Annotated

from fastapi import APIRouter, Body, Depends, File, Path, Query, Security, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.response import ResponseSchema, StreamResponse, SuccessResponse
from app.core.base_schema import AuthSchema, BatchSetAvailable, PageResultSchema, PaginationQueryParam
from app.core.dependencies import AuthPermission, db_getter, get_current_user
from app.core.router_class import OperationLogRoute
from app.utils.common_util import bytes2file_response

from .schema import TestDemoBaseCreateSchema, TestDemoBaseOutSchema, TestDemoBaseQueryParam, TestDemoBaseUpdateSchema
from .service import TestDemoBaseService

TestDemoBaseRouter = APIRouter(route_class=OperationLogRoute, prefix="/test_demo_base", tags=["基础测试管理模块"])


@TestDemoBaseRouter.get("/detail/{id}", summary="获取基础测试管理详情", response_model=ResponseSchema[TestDemoBaseOutSchema])
async def get_obj_detail_controller(
    auth: Annotated[AuthSchema, Security(AuthPermission(["module_demo:test_demo_base:detail"]))],
    id: Annotated[int, Path(description="基础测试管理ID", ge=1)],
    db: Annotated[AsyncSession, Depends(db_getter)],
) -> JSONResponse:
    service = TestDemoBaseService(auth, db)
    result_dict = await service.detail(id=id)
    return SuccessResponse(data=result_dict, msg="获取基础测试管理详情成功")


@TestDemoBaseRouter.get("/list", summary="分页查询基础测试管理", response_model=ResponseSchema[PageResultSchema[TestDemoBaseOutSchema]])
async def get_obj_list_controller(
    auth: Annotated[AuthSchema, Security(AuthPermission(["module_demo:test_demo_base:query"]))],
    page: Annotated[PaginationQueryParam, Depends()],
    search: Annotated[TestDemoBaseQueryParam, Query()],
    db: Annotated[AsyncSession, Depends(db_getter)],
) -> JSONResponse:
    service = TestDemoBaseService(auth, db)
    result_dict = await service.page(
        page_no=page.page_no,
        page_size=page.page_size,
        search=search,
        order_by=page.order_by,
    )
    return SuccessResponse(data=result_dict, msg="查询基础测试管理列表成功")


@TestDemoBaseRouter.post("/create", status_code=status.HTTP_201_CREATED, summary="创建基础测试管理", response_model=ResponseSchema[TestDemoBaseOutSchema])
async def create_obj_controller(
    auth: Annotated[AuthSchema, Security(AuthPermission(["module_demo:test_demo_base:create"]))],
    data: Annotated[TestDemoBaseCreateSchema, Body(description="创建参数")],
    db: Annotated[AsyncSession, Depends(db_getter)],
) -> JSONResponse:
    service = TestDemoBaseService(auth, db)
    result_dict = await service.create(data=data)
    return SuccessResponse(data=result_dict, msg="创建基础测试管理成功")


@TestDemoBaseRouter.put("/update/{id}", summary="修改基础测试管理", response_model=ResponseSchema[TestDemoBaseOutSchema])
async def update_obj_controller(
    auth: Annotated[AuthSchema, Security(AuthPermission(["module_demo:test_demo_base:update"]))],
    id: Annotated[int, Path(description="基础测试管理ID", ge=1)],
    data: Annotated[TestDemoBaseUpdateSchema, Body(description="修改参数")],
    db: Annotated[AsyncSession, Depends(db_getter)],
) -> JSONResponse:
    service = TestDemoBaseService(auth, db)
    result_dict = await service.update(id=id, data=data)
    return SuccessResponse(data=result_dict, msg="修改基础测试管理成功")


@TestDemoBaseRouter.delete("/delete", summary="删除基础测试管理", response_model=ResponseSchema[None])
async def delete_obj_controller(
    auth: Annotated[AuthSchema, Security(AuthPermission(["module_demo:test_demo_base:delete"]))],
    ids: Annotated[list[int], Body(description="ID列表")],
    db: Annotated[AsyncSession, Depends(db_getter)],
) -> JSONResponse:
    service = TestDemoBaseService(auth, db)
    await service.delete(ids=ids)
    return SuccessResponse(msg="删除基础测试管理成功")


@TestDemoBaseRouter.patch("/status/batch", summary="批量修改基础测试管理状态", response_model=ResponseSchema[None])
async def batch_set_available_obj_controller(
    auth: Annotated[AuthSchema, Security(AuthPermission(["module_demo:test_demo_base:patch"]))],
    data: Annotated[BatchSetAvailable, Body(description="状态设置")],
    db: Annotated[AsyncSession, Depends(db_getter)],
) -> JSONResponse:
    service = TestDemoBaseService(auth, db)
    await service.set_available(data=data)
    return SuccessResponse(msg="批量修改基础测试管理状态成功")


@TestDemoBaseRouter.post("/export", summary="导出基础测试管理")
async def export_obj_list_controller(
    auth: Annotated[AuthSchema, Security(AuthPermission(["module_demo:test_demo_base:export"]))],
    search: Annotated[TestDemoBaseQueryParam, Body()],
    db: Annotated[AsyncSession, Depends(db_getter)],
) -> StreamingResponse:
    service = TestDemoBaseService(auth, db)
    result_dict_list = await service.get_list(search=search)
    export_result = await TestDemoBaseService(auth, db).batch_export(obj_list=[item.model_dump() for item in result_dict_list])

    return StreamResponse(
        data=bytes2file_response(export_result),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=test_demo_base.xlsx"},
    )


@TestDemoBaseRouter.post("/import", summary="导入基础测试管理", response_model=ResponseSchema[str])
async def import_obj_list_controller(
    file: Annotated[UploadFile, File(description="导入文件")],
    auth: Annotated[AuthSchema, Security(AuthPermission(["module_demo:test_demo_base:import"]))],
    db: Annotated[AsyncSession, Depends(db_getter, scope="function")],
) -> JSONResponse:
    service = TestDemoBaseService(auth, db)
    batch_import_result = await service.batch_import(file=file, update_support=True)
    return SuccessResponse(data=batch_import_result, msg="导入基础测试管理成功")


@TestDemoBaseRouter.post("/download/template", summary="获取基础测试管理导入模板", dependencies=[Security(AuthPermission(["module_demo:test_demo_base:download"]))])
async def export_obj_template_controller(
    auth: Annotated[AuthSchema, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(db_getter)],
) -> StreamingResponse:
    import_template_result = await TestDemoBaseService(auth, db).import_template_download()

    return StreamResponse(
        data=bytes2file_response(import_template_result),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={urllib.parse.quote('基础测试管理导入模板.xlsx')}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
