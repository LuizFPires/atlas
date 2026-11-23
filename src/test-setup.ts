import '@testing-library/jest-dom/vitest'

// Cada teste começa sem rascunho guardado (os rascunhos das telas ficam no localStorage).
beforeEach(() => { try { localStorage.clear() } catch { /* ambiente sem localStorage */ } })
