import '@testing-library/jest-dom'
import { JSDOM } from 'jsdom'

// Set up jsdom
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
})

// @ts-ignore
global.window = dom.window
// @ts-ignore
global.document = dom.window.document
// @ts-ignore
global.navigator = dom.window.navigator
// @ts-ignore
global.HTMLElement = dom.window.HTMLElement
// @ts-ignore
global.HTMLInputElement = dom.window.HTMLInputElement
// @ts-ignore
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
// @ts-ignore
global.localStorage = dom.window.localStorage
// @ts-ignore
global.sessionStorage = dom.window.sessionStorage