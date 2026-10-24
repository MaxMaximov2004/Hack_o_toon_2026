import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { CalcParamsForm } from './CalcParamsForm'
import { EquipmentPicker } from './EquipmentPicker'
import { CustomItems } from './CustomItems'
import { DEFAULT_CALC_PARAMS } from './calcParams'
import type { CalcCatalog } from './types'
import catalogFixture from '../mocks/fixtures/calc-catalog.json'

const catalog = catalogFixture as CalcCatalog

describe('CalcParamsForm', () => {
  it('регион, уровень, этап, срочность, финансирование → onChange с нужным полем', () => {
    const onChange = vi.fn()
    render(<CalcParamsForm catalog={catalog} params={DEFAULT_CALC_PARAMS} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Регион'), { target: { value: '5' } })
    expect(onChange).toHaveBeenLastCalledWith({ regionId: 5 })

    fireEvent.click(screen.getByRole('radio', { name: /Экспертный/ }))
    expect(onChange).toHaveBeenLastCalledWith({ level: 'expert' })

    fireEvent.click(screen.getByRole('checkbox', { name: /Шеф-монтаж/ }))
    expect(onChange).toHaveBeenLastCalledWith({ stages: ['pir', 'pnr'] })

    fireEvent.click(screen.getByRole('checkbox', { name: /Срочный проект/ }))
    expect(onChange).toHaveBeenLastCalledWith({ urgent: true })

    fireEvent.click(screen.getByRole('button', { name: 'Лизинг' }))
    expect(onChange).toHaveBeenLastCalledWith({ financing: 'leasing' })
  })

  it('уровни по возрастанию коэффициента, у региона — причина коэффициента', () => {
    render(<CalcParamsForm catalog={catalog} params={DEFAULT_CALC_PARAMS} onChange={vi.fn()} />)
    const names = screen.getAllByRole('radio').map((r) => r.closest('label')!.textContent!.split(' ')[0])
    expect(names).toEqual(['Базовый', 'Продвинутый', 'Экспертный'])
    expect(screen.getByText('Удаленность складов')).toBeInTheDocument()
  })

  it('срок: неверное значение не уходит в URL и подсвечивается', () => {
    const onChange = vi.fn()
    render(<CalcParamsForm catalog={catalog} params={DEFAULT_CALC_PARAMS} onChange={onChange} />)
    const term = screen.getByLabelText('Срок, мес')
    fireEvent.change(term, { target: { value: '0' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Целое число месяцев, не меньше 1')).toBeInTheDocument()
    fireEvent.change(term, { target: { value: '24' } })
    expect(onChange).toHaveBeenLastCalledWith({ termMonths: 24 })
  })
})

describe('EquipmentPicker', () => {
  it('«+» добавляет позицию, «нестандарт» ставит флаг, «−» до нуля убирает', () => {
    const onChange = vi.fn()
    const { rerender } = render(<EquipmentPicker catalog={catalog} items={[]} onChange={onChange} />)
    // Ничего не выбрано — открыта первая группа (Вентиляция)
    fireEvent.click(screen.getByRole('button', { name: 'Больше: Датчик CO2' }))
    expect(onChange).toHaveBeenLastCalledWith([{ componentId: 'vn_02', qty: 1 }])

    rerender(<EquipmentPicker catalog={catalog} items={[{ componentId: 'vn_02', qty: 1 }]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Нестандартное исполнение/ }))
    expect(onChange).toHaveBeenLastCalledWith([{ componentId: 'vn_02', qty: 1, nonStandard: true }])

    fireEvent.click(screen.getByRole('button', { name: 'Меньше: Датчик CO2' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('количество с клавиатуры, больше 100 000 — обрезается до лимита calc-service', () => {
    const onChange = vi.fn()
    render(<EquipmentPicker catalog={catalog} items={[]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Количество: Контроллер ПВУ'), { target: { value: '250000' } })
    expect(onChange).toHaveBeenLastCalledWith([{ componentId: 'vn_01', qty: 100000 }])
  })

  it('группы раскрываются; в заголовке — число выбранных', () => {
    render(
      <EquipmentPicker catalog={catalog} items={[{ componentId: 'el_01', qty: 3 }]} onChange={vi.fn()} />
    )
    const header = screen.getByRole('button', { name: /Электроснабжение/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(within(header).getByText('1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Газоснабжение/ }))
    expect(screen.getByText('Газоанализатор (метановый)')).toBeInTheDocument()
  })
})

describe('CustomItems', () => {
  it('пустая форма — кнопка неактивна; заполненная — добавляет и очищается', () => {
    const onAdd = vi.fn()
    render(<CustomItems items={[]} onAdd={onAdd} onRemove={vi.fn()} />)
    const add = screen.getByRole('button', { name: 'Добавить позицию' })
    expect(add).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'ПО диспетчеризации' } })
    fireEvent.change(screen.getByLabelText('Ед. изм.'), { target: { value: 'лиц.' } })
    fireEvent.change(screen.getByLabelText('Цена за ед., ₽'), { target: { value: '150000,50' } })
    expect(add).toBeEnabled()
    fireEvent.click(add)
    expect(onAdd).toHaveBeenCalledWith({ name: 'ПО диспетчеризации', unit: 'лиц.', unitPrice: 150000.5, qty: 1, complexity: 1 })
    expect(screen.getByLabelText('Название')).toHaveValue('')
  })

  it('удаление своей позиции', () => {
    const onRemove = vi.fn()
    render(
      <CustomItems
        items={[{ id: 7, name: 'Сервер', unit: 'шт.', unitPrice: 90000, qty: 2, complexity: 1 }]}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Удалить: Сервер' }))
    expect(onRemove).toHaveBeenCalledWith(7)
  })
})
