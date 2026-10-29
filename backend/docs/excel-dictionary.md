# Excel 字典转换

`ExcelDictConfig` 按业务字段名配置，表头仍由 `mapping_dict` 定义。数据源统一使用 `DictService`，数据库字典和注册枚举字典调用方式相同。

```python
from app.modules.system.dict.service import DictService
from app.utils.excel_dict import ExcelDictConfig, ExcelDictSnapshot
from app.utils.excel_util import ExcelUtil

configs = {
    "status": ExcelDictConfig("sys_enable_status", code_type=int),
    "tags": ExcelDictConfig("tags", mode="multiple", storage="delimited", storage_separator=";"),
    "area": ExcelDictConfig("area", mode="cascade", storage="json"),
    "areas": ExcelDictConfig("area", mode="cascade_multiple", separator=";", path_separator=" > "),
}
headers = {"status": "状态", "tags": "标签", "area": "区域", "areas": "多个区域"}
snapshot = await ExcelDictSnapshot.load(DictService(auth, db), configs)
contents = await ExcelUtil.aexport_list2excel(rows, headers, dictionary=snapshot)

snapshot = await ExcelDictSnapshot.load(DictService(auth, db), configs, importing=True)
rows = await ExcelUtil.aread_excel_to_dicts(
    contents, dictionary=snapshot, header_mapping={label: field for field, label in headers.items()}
)
```

## 格式约定

- `mode`: `single` 普通单选、`multiple` 普通多选、`cascade` 级联单选、`cascade_multiple` 级联多选。
- `storage`: 导入后的业务格式，`array` 原生数组（默认）、`json` JSON 数组字符串、`delimited` 分隔字符串（仅普通多选）。单选不使用此配置。
- `code_type`: `str`（默认）、`int` 或 `bool`。保留 `01` 等编码时使用 `str`。
- `separator`: Excel 多项分隔符，默认英文逗号；`path_separator`: 层级分隔符，默认 ` / `；`storage_separator`: 业务字符串分隔符，默认英文逗号。均按精确字符串拆分，不猜测中英文标点，不自动去空格或去重。
- `excel_format`: `text`（默认）或 `json`。多选名称含分隔符时自动输出 JSON，避免导入时歧义。
- 普通多选导出自动识别原生数组、JSON 数组字符串及存储分隔字符串；导入兼容名称 JSON 数组及 Excel 分隔文本。
- 级联业务数据必须是完整编码路径：单选 `["east","01"]`，多选 `[["east","01"],["west","02"]]`；允许对应的 JSON 字符串，不含字典类型根节点。Excel 名称 JSON 保持相同维度。
- 空单元格保留为空；空数组输出 `[]`，导入按 `storage` 还原。是否必填由业务校验决定。

## 校验与模板

导入只接受有效字典项，逐层匹配名称；同级重名、未知名称、非法路径或结构均报错。文件读取汇总物理行号、字段、原值及原因后抛出 `ValueError`，业务层转换为 `CustomException`。字典转换失败时不返回可保存的数据。

导出可显示仍存在的停用项；找不到值时保留整个单元格原始业务值，数组以 JSON 文本呈现。字典加载或数据库错误直接传播，不吞掉基础设施异常。每次操作每种字典仅加载一次，在线程处理 Excel 之前完成查询，操作结束后快照自然释放，不修改源数据。

模板调用 `ExcelUtil.get_excel_template(..., dictionary=snapshot, mapping_dict=headers)`，快照使用 `importing=True`。普通单选采用隐藏选项表和命名区域下拉，支持长选项及带逗号名称；多选和级联提供表头批注说明及示例。模板生成放在线程执行，不增加 Excel 级联联动控件。

用户及示例插件模板状态使用字典标准名称“启用/停用”，旧模板的“正常”不再自动解释为启用，需重新下载模板或改为“启用”。已接入用户、角色、岗位、工单和两个示例插件中的字典字段。普通导出接口及 ExcelUtil 不带字典配置的调用保持原样；业务 Service 的导出方法现使用实例，以便传入当前数据库上下文。

三个导入接口的数据库依赖使用 `scope="function"`：事务提交及提交后回调完成后才发送成功响应，避免前端收到导入成功后立即刷新仍查不到数据。提交失败时不返回成功；现有提交后操作日志机制保留。

## 本地联调

启动现有 MySQL、Redis、后端和 Vite 后，在 `backend/` 目录运行 `tests/manual/verify_excel_dictionary.py`，通过环境变量 `RESNEXUS_TEST_PASSWORD` 提供本地 `super` 账号口令。脚本仅面向本机开发环境，使用框架已有的开发文档登录流程，不修改验证码配置；凭据和令牌不写入文件。

脚本验证真实模板及选项、导入后立即查询、MySQL 编码及密码哈希、按条件导出、非法字典值拒绝及其他系统导出。只创建独立命名的停用无角色测试用户，并在退出前通过正常删除接口软删除。四种模式及多选、级联边界由 `test_excel_dict.py`、`test_excel_dict_business.py` 覆盖；提交顺序、提交失败回滚和操作日志由 `test_excel_import_transaction.py` 覆盖。

2026-10-29 本地 Vite → API → MySQL/Redis 联调通过。浏览器自动化因无法可靠识别当前 Windows 浏览器 URL 被工具停止，本次没有将完整页面点击流程记为已验证。
