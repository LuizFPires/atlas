import { sistemaDoNavegador, temToque } from './sistema'

test('Mac pelo navegador (Safari, Chrome ou o platform novo); Windows e o resto ficam Windows', () => {
  expect(sistemaDoNavegador({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15' })).toBe('mac')
  expect(sistemaDoNavegador({ userAgentData: { platform: 'macOS' }, userAgent: '' })).toBe('mac')
  expect(sistemaDoNavegador({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' })).toBe('windows')
  expect(sistemaDoNavegador({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe('windows')
  expect(sistemaDoNavegador({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' })).toBe('windows')
  expect(temToque({ maxTouchPoints: 5 })).toBe(true)
  expect(temToque({ maxTouchPoints: 0 })).toBe(false)
})
