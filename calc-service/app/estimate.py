"""Pydantic-модели и эндпоинт /estimate."""

from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.engine import calculate_estimate


class EstimateItem(BaseModel):
    componentId: str
    qty: int = Field(ge=1, le=100000)
    nonStandard: bool = False

    @field_validator("componentId")
    @classmethod
    def check_cid(cls, v):
        if not v or not v.strip():
            raise ValueError("componentId не может быть пустым")
        return v


class CustomItem(BaseModel):
    name: str
    unit: str
    unitPrice: float
    qty: int = Field(ge=1, le=100000)
    complexity: float = 1.0


class ProposalClient(BaseModel):
    """Клиент для шапки КП и лида в CRM: название обязательно, ИНН и контакт — по желанию."""
    name: str = Field(min_length=1, max_length=300)
    inn: str | None = None
    contact: str | None = None


class EstimateRequest(BaseModel):
    regionId: int
    level: str
    stages: list[str]
    items: list[EstimateItem] = Field(max_length=200)
    customItems: list[CustomItem] = []
    urgent: bool = False
    uniqueSolution: bool = False
    termMonths: int = 12
    financing: str = "prepay"
    # Только для /proposal и /export/bitrix; расчёт его не использует. Без поля Pydantic молча отбрасывал client
    client: ProposalClient | None = None


def handle_estimate(req: EstimateRequest, catalog_validator) -> dict:
    """
    Валидирует и считает estimate.
    catalog_validator — объект с методами validate_*.
    """
    # Валидация
    if not catalog_validator.validate_region(req.regionId):
        raise ValueError(f"Неизвестный регион: {req.regionId}")
    if not catalog_validator.validate_level(req.level):
        raise ValueError(f"Неизвестный уровень: {req.level}")
    if not catalog_validator.validate_stages(req.stages):
        raise ValueError(f"Неизвестные этапы: {[s for s in req.stages]}")
    if not catalog_validator.validate_components([i.componentId for i in req.items]):
        ids = [i.componentId for i in req.items]
        raise ValueError(f"Неизвестные компоненты: {ids}")

    # Проверка дубликатов componentId
    seen = set()
    for i, item in enumerate(req.items):
        if item.componentId in seen:
            raise ValueError(f"Дубликат позиции [{i}]: {item.componentId}")
        seen.add(item.componentId)

    result = calculate_estimate(
        region_id=req.regionId,
        level=req.level,
        stages=req.stages,
        items=req.items,
        custom_items=req.customItems,
        urgent=req.urgent,
        unique_solution=req.uniqueSolution,
        term_months=req.termMonths,
        financing=req.financing,
    )
    return result
