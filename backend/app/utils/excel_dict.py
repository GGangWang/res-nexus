"""Operation-local Excel dictionary snapshots and bidirectional conversion."""

import json
from dataclasses import dataclass
from enum import Enum
from typing import Literal


@dataclass(frozen=True)
class ExcelDictConfig:
    dict_type: str
    mode: Literal["single", "multiple", "cascade", "cascade_multiple"] = "single"
    storage: Literal["array", "json", "delimited"] = "array"
    code_type: type = str
    separator: str = ","
    path_separator: str = " / "
    storage_separator: str = ","
    excel_format: Literal["text", "json"] = "text"

    def __post_init__(self):
        if self.mode not in ("single", "multiple", "cascade", "cascade_multiple"):
            raise ValueError("无效的字典转换模式")
        if self.storage not in ("array", "json", "delimited") or self.excel_format not in ("text", "json"):
            raise ValueError("无效的字典值格式")
        if self.code_type not in (str, int, bool):
            raise ValueError("编码类型仅支持 str/int/bool")
        if not all((self.dict_type, self.separator, self.path_separator, self.storage_separator)):
            raise ValueError("字典类型及分隔符不能为空")
        if self.mode.startswith("cascade") and self.storage == "delimited":
            raise ValueError("级联业务值必须使用数组或 JSON")
        if self.mode == "cascade_multiple" and self.excel_format == "text" and (self.separator in self.path_separator or self.path_separator in self.separator):
            raise ValueError("多项分隔符和层级分隔符不能相互包含")


def code_key(value):
    if isinstance(value, Enum):
        value = value.value
    return str(value).lower() if isinstance(value, bool) else str(value)


def excel_raw(value):
    return json.dumps(value, ensure_ascii=False) if isinstance(value, (list, tuple, dict)) else value


class ExcelDictSnapshot:
    def __init__(self, configs: dict[str, ExcelDictConfig], nodes: dict[str, list[dict]]):
        self.configs = dict(configs)
        self.children = {}
        self.indices = {}
        for kind, rows in nodes.items():
            children = {}
            for row in rows:
                children.setdefault(row["parent_id"], []).append(dict(row))
            self.children[kind] = children
            for parent, siblings in children.items():
                for importing, key in ((True, "dict_name"), (False, "dict_code")):
                    index = {}
                    for row in siblings:
                        index.setdefault(row[key], []).append(row)
                    self.indices[kind, parent, importing] = index

    @classmethod
    async def load(cls, service, configs, *, importing=False, redis=None):
        nodes = {}
        for config in configs.values():
            if config.dict_type not in nodes:
                nodes[config.dict_type] = await service.effective(config.dict_type, redis) if importing else await service.all_nodes(config.dict_type)
        return cls(configs, nodes)

    def _root(self, config):
        roots = self.children.get(config.dict_type, {}).get(None, [])
        if len(roots) != 1:
            raise ValueError(f"字典 {config.dict_type} 不存在或根节点不唯一")
        return roots[0]["id"]

    def _cast(self, value, config):
        if config.code_type is bool:
            if code_key(value) not in ("true", "false", "1", "0"):
                raise ValueError("编码不能转换为布尔值")
            return code_key(value) in ("true", "1")
        return config.code_type(value)

    def _path(self, values, config, importing):
        parent, result = self._root(config), []
        if not values or any(isinstance(v, (list, dict)) or v is None or v == "" for v in values):
            raise ValueError("路径或选项不能为空，且必须为标量")
        for value in values:
            matches = self.indices.get((config.dict_type, parent, importing), {}).get(str(value) if importing else code_key(value), [])
            if len(matches) != 1:
                raise ValueError(f"{'名称' if importing else '编码'} {value!r} 未匹配或存在歧义")
            row = matches[0]
            result.append(self._cast(row["dict_code"], config) if importing else row["dict_name"])
            parent = row["id"]
        return result

    @staticmethod
    def _parse(value):
        if isinstance(value, str) and value.lstrip().startswith("["):
            try:
                parsed = json.loads(value)
            except ValueError as exc:
                raise ValueError("JSON 数组格式错误") from exc
            if not isinstance(parsed, list):
                raise ValueError("必须为 JSON 数组")
            return parsed
        return value

    def convert(self, field, value, *, importing=False):
        if value is None or value == "":
            return value
        config = self.configs[field]
        try:
            return self._convert(value, config, importing)
        except (ValueError, TypeError, KeyError):
            if importing:
                raise
            return excel_raw(value)

    def _convert(self, value, config, importing):
        if config.mode == "single":
            return self._path([value], config, importing)[0]
        parsed = self._parse(value)
        if not isinstance(parsed, list):
            if not isinstance(parsed, str):
                raise ValueError("多选或级联值必须为数组或字符串")
            if not importing and config.mode.startswith("cascade"):
                raise ValueError("级联业务值必须为完整路径数组")
            if config.mode == "cascade":
                parsed = parsed.split(config.path_separator)
            else:
                parsed = parsed.split(config.separator if importing else config.storage_separator)
                if config.mode == "cascade_multiple":
                    parsed = [path.split(config.path_separator) for path in parsed]
        if parsed == []:
            result = []
        elif config.mode == "multiple":
            result = [self._path([item], config, importing)[0] for item in parsed]
        elif config.mode == "cascade":
            result = self._path(parsed, config, importing)
        else:
            if any(not isinstance(path, list) for path in parsed):
                raise ValueError("级联多选必须为二维路径数组")
            result = [self._path(path, config, importing) for path in parsed]
        if importing:
            if config.storage == "json":
                return json.dumps(result, ensure_ascii=False)
            if config.storage == "delimited":
                if any(config.storage_separator in code_key(v) for v in result):
                    raise ValueError("编码包含存储分隔符，请使用数组或 JSON 存储")
                return config.storage_separator.join(code_key(v) for v in result)
            return result
        # Ambiguous labels are emitted as JSON automatically, preserving round trips.
        labels = result if config.mode != "cascade_multiple" else [v for path in result for v in path]
        if not result or config.excel_format == "json" or any(config.separator in label or config.path_separator in label or label.lstrip().startswith("[") for label in labels):
            return json.dumps(result, ensure_ascii=False)
        if config.mode == "cascade":
            return config.path_separator.join(result)
        if config.mode == "cascade_multiple":
            return config.separator.join(config.path_separator.join(path) for path in result)
        return config.separator.join(result)

    def import_row(self, row, row_number, headers=None):
        result, errors = dict(row), []
        for field in self.configs:
            if field not in row:
                continue
            try:
                result[field] = self.convert(field, row[field], importing=True)
            except (ValueError, TypeError, KeyError) as exc:
                errors.append(f"第{row_number}行，字段'{(headers or {}).get(field, field)}'，原值 {row[field]!r}: {exc}")
        return result, errors

    def options(self, field):
        config = self.configs[field]
        return [row["dict_name"] for row in self.children[config.dict_type].get(self._root(config), [])]

    def examples(self, field):
        config = self.configs[field]
        if config.mode == "multiple":
            rows = self.children[config.dict_type].get(self._root(config), [])
            return self._convert([row["dict_code"] for row in rows[:2]], config, False)
        queue = [(self._root(config), [])]
        for parent, path in queue:
            children = self.children[config.dict_type].get(parent, [])
            if path and not children:
                return self._convert([path] if config.mode == "cascade_multiple" else path, config, False)
            queue.extend((row["id"], [*path, row["dict_code"]]) for row in children)
        return ""
