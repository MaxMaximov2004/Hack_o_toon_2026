import { describe, it, expect } from 'vitest'
import { plural } from './plural'

const forms: [string, string, string] = ['проект', 'проекта', 'проектов']

describe('plural', () => {
  it('1, 21 — проект; 2–4, 63 — проекта; 5, 11–14, 100 — проектов', () => {
    expect([1, 21, 101].map((n) => plural(n, forms))).toEqual(['проект', 'проект', 'проект'])
    expect([2, 4, 63].map((n) => plural(n, forms))).toEqual(['проекта', 'проекта', 'проекта'])
    expect([0, 5, 11, 12, 14, 100].map((n) => plural(n, forms))).toEqual(Array(6).fill('проектов'))
  })
})
