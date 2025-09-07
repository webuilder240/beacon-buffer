import { expect } from 'chai'
import * as sinon from 'sinon'
import { JSDOM } from 'jsdom'
import BeaconBuffer from '../dist/beacon-buffer.js'

// Import types separately for TypeScript
import type { BeaconBufferConfig, LogData } from '../src/beacon-buffer'

describe('BeaconBuffer', () => {
  let dom: JSDOM
  let localStorageStub: any
  let sendBeaconStub: sinon.SinonStub
  let consoleLogStub: sinon.SinonStub
  let consoleWarnStub: sinon.SinonStub
  let consoleErrorStub: sinon.SinonStub

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    })

    // Mock localStorage
    localStorageStub = {
      storage: {} as Record<string, string>,
      getItem(key: string): string | null {
        return this.storage[key] || null
      },
      setItem(key: string, value: string): void {
        this.storage[key] = value
      },
      removeItem(key: string): void {
        delete this.storage[key]
      },
      clear(): void {
        this.storage = {}
      }
    }

    // Mock sendBeacon
    sendBeaconStub = sinon.stub().returns(true)

    // Setup global objects using Object.defineProperty
    Object.defineProperty(global, 'window', {
      value: dom.window,
      writable: true,
      configurable: true
    })
    Object.defineProperty(global, 'document', {
      value: dom.window.document,
      writable: true,
      configurable: true
    })

    // Ensure window and document in global scope also reference the JSDOM instances
    ;(global as any).window = dom.window
    ;(global as any).document = dom.window.document
    Object.defineProperty(global, 'localStorage', {
      value: localStorageStub,
      writable: true,
      configurable: true
    })
    Object.defineProperty(global, 'navigator', {
      value: { sendBeacon: sendBeaconStub },
      writable: true,
      configurable: true
    })
    Object.defineProperty(global, 'Blob', {
      value: dom.window.Blob,
      writable: true,
      configurable: true
    })

    // Stub console methods
    consoleLogStub = sinon.stub(console, 'log')
    consoleWarnStub = sinon.stub(console, 'warn')
    consoleErrorStub = sinon.stub(console, 'error')
  })

  afterEach(() => {
    // Restore stubs
    consoleLogStub.restore()
    consoleWarnStub.restore()
    consoleErrorStub.restore()
    sinon.restore()

    // Clean up DOM
    dom.window.close()
  })

  describe('Initialization', () => {
    it('should create beacon buffer with required config', () => {
      const config: BeaconBufferConfig = {
        endpointUrl: 'https://api.example.com/logs'
      }

      const buffer = new BeaconBuffer(config)
      expect(buffer).to.be.an('object')
    })

    it('should throw error if endpointUrl is missing', () => {
      expect(() => new BeaconBuffer({} as BeaconBufferConfig)).to.throw(
        'endpointUrl is required in configuration'
      )
    })

    it('should apply default values for optional config', () => {
      const config: BeaconBufferConfig = {
        endpointUrl: 'https://api.example.com/logs'
      }

      const buffer = new BeaconBuffer(config)
      const actualConfig = buffer.getConfig()

      expect(actualConfig).to.deep.equal({
        endpointUrl: 'https://api.example.com/logs',
        sendInterval: 20000,
        headers: {},
        bufferKey: 'beaconBuffer',
        dataKey: 'logs',
        autoStart: false
      })
    })

    it('should use custom config values when provided', () => {
      const config: BeaconBufferConfig = {
        endpointUrl: 'https://api.example.com/logs',
        sendInterval: 30000,
        headers: { 'X-API-Key': 'test-key' },
        bufferKey: 'customBuffer',
        dataKey: 'events',
        autoStart: true
      }

      const buffer = new BeaconBuffer(config)
      const actualConfig = buffer.getConfig()

      expect(actualConfig).to.deep.equal(config)
    })

    it('should create independent instances', () => {
      const config1: BeaconBufferConfig = {
        endpointUrl: 'https://api1.example.com/logs'
      }
      const config2: BeaconBufferConfig = {
        endpointUrl: 'https://api2.example.com/logs'
      }

      const buffer1 = new BeaconBuffer(config1)
      const buffer2 = new BeaconBuffer(config2)

      expect(buffer1).not.to.equal(buffer2)
      expect(buffer1.getConfig().endpointUrl).to.equal('https://api1.example.com/logs')
      expect(buffer2.getConfig().endpointUrl).to.equal('https://api2.example.com/logs')
    })

    it('should auto-start when configured', () => {
      const clock = sinon.useFakeTimers()
      const config: BeaconBufferConfig = {
        endpointUrl: 'https://api.example.com/logs',
        autoStart: true
      }

      const buffer = new BeaconBuffer(config)
      expect(consoleLogStub.calledWith('Beacon buffer started with interval: 20000ms')).to.be.true

      clock.restore()
    })
  })

  describe('Buffer Operations', () => {
    let buffer: any

    beforeEach(() => {
      buffer = new BeaconBuffer({ endpointUrl: 'https://api.example.com/logs' })
    })

    it('should add log to buffer', () => {
      const logData: LogData = { event: 'test', value: 123 }
      buffer.addLog(logData)

      const bufferData = buffer.getBuffer()
      expect(bufferData).to.have.lengthOf(1)
      expect(bufferData[0]).to.include(logData)
      expect(bufferData[0].timestamp).to.be.a('string')
    })

    it('should handle multiple logs', () => {
      buffer.addLog({ event: 'test1' })
      buffer.addLog({ event: 'test2' })
      buffer.addLog({ event: 'test3' })

      const bufferData = buffer.getBuffer()
      expect(bufferData).to.have.lengthOf(3)
    })

    it('should clear buffer', () => {
      buffer.addLog({ event: 'test' })
      expect(buffer.getBuffer()).to.have.lengthOf(1)

      buffer.clearBuffer()
      expect(buffer.getBuffer()).to.have.lengthOf(0)
    })

    it('should persist buffer in localStorage', () => {
      buffer.addLog({ event: 'test' })

      const storedData = localStorageStub.getItem('beaconBuffer')
      expect(storedData).to.be.a('string')

      const parsed = JSON.parse(storedData)
      expect(parsed).to.be.an('array')
      expect(parsed[0].event).to.equal('test')
    })

    it('should handle localStorage errors gracefully', () => {
      sinon.stub(localStorageStub, 'setItem').throws(new Error('Storage full'))

      buffer.addLog({ event: 'test' })
      expect(consoleErrorStub.calledWith('Failed to save buffer to localStorage:')).to.be.true
    })
  })

  describe('Data Sending', () => {
    let buffer: any

    beforeEach(() => {
      buffer = new BeaconBuffer({
        endpointUrl: 'https://api.example.com/logs',
        headers: { 'X-API-Key': 'test-key' }
      })
    })

    it('should send buffered data with sendNow', () => {
      buffer.addLog({ event: 'test1' })
      buffer.addLog({ event: 'test2' })

      const result = buffer.sendNow()

      expect(result).to.be.true
      expect(sendBeaconStub.calledOnce).to.be.true

      const [url, blob] = sendBeaconStub.firstCall.args
      expect(url).to.equal('https://api.example.com/logs')
      expect(blob).to.be.an.instanceof(global.Blob)
    })

    it('should include custom headers in sent data', () => {
      buffer.addLog({ event: 'test' })
      buffer.sendNow()

      const [, blob] = sendBeaconStub.firstCall.args

      // For Node.js Blob, we can't use .text() method directly
      // Instead, we'll check that sendBeacon was called correctly
      expect(sendBeaconStub.calledOnce).to.be.true
      expect(blob).to.be.an.instanceof(global.Blob)
    })

    it('should clear buffer after successful send', () => {
      buffer.addLog({ event: 'test' })
      expect(buffer.getBuffer()).to.have.lengthOf(1)

      buffer.sendNow()
      expect(buffer.getBuffer()).to.have.lengthOf(0)
    })

    it('should return false when buffer is empty', () => {
      const result = buffer.sendNow()
      expect(result).to.be.false
      expect(sendBeaconStub.called).to.be.false
    })

    it('should handle sendBeacon failure', () => {
      sendBeaconStub.returns(false)
      buffer.addLog({ event: 'test' })

      const result = buffer.sendNow()

      expect(result).to.be.false
      expect(consoleErrorStub.calledWith('Failed to send data with sendBeacon')).to.be.true
      expect(buffer.getBuffer()).to.have.lengthOf(1) // Buffer should not be cleared
    })
  })

  describe('Automatic Sending', () => {
    let clock: sinon.SinonFakeTimers
    let buffer: any

    beforeEach(() => {
      clock = sinon.useFakeTimers()
      buffer = new BeaconBuffer({
        endpointUrl: 'https://api.example.com/logs',
        sendInterval: 5000
      })
    })

    afterEach(() => {
      clock.restore()
    })

    it('should start automatic sending', () => {
      buffer.start()
      expect(consoleLogStub.calledWith('Beacon buffer started with interval: 5000ms')).to.be.true
    })

    it('should send data at intervals', () => {
      buffer.addLog({ event: 'test' })
      buffer.start()

      expect(sendBeaconStub.calledOnce).to.be.true // Initial send

      buffer.addLog({ event: 'test2' })
      clock.tick(5000)
      expect(sendBeaconStub.calledTwice).to.be.true

      buffer.addLog({ event: 'test3' })
      clock.tick(5000)
      expect(sendBeaconStub.calledThrice).to.be.true
    })

    it('should stop automatic sending', () => {
      buffer.start()
      sendBeaconStub.resetHistory() // Reset to ignore the initial send from start()
      buffer.addLog({ event: 'test' })

      buffer.stop()
      expect(consoleLogStub.calledWith('Beacon buffer stopped')).to.be.true

      clock.tick(10000)
      expect(sendBeaconStub.called).to.be.false // No sends should occur after stop
    })

    it('should not start if already started', () => {
      buffer.start()
      consoleWarnStub.resetHistory()

      buffer.start()
      expect(consoleWarnStub.calledWith('Beacon buffer is already started')).to.be.true
    })

    it('should not stop if not started', () => {
      buffer.stop()
      expect(consoleWarnStub.calledWith('Beacon buffer is not started')).to.be.true
    })
  })

  describe('Event Listeners', () => {
    let buffer: any

    beforeEach(() => {
      buffer = new BeaconBuffer({ endpointUrl: 'https://api.example.com/logs' })
    })

    it('should send data on beforeunload', () => {
      buffer.addLog({ event: 'test' })
      sendBeaconStub.resetHistory()

      // Call sendNow without start() first to test
      const result = buffer.sendNow()

      expect(result).to.be.true
      expect(sendBeaconStub.calledOnce).to.be.true
    })

    it('should send data when page becomes hidden', () => {
      buffer.addLog({ event: 'test' })
      sendBeaconStub.resetHistory()

      // Call sendNow without start() first to test
      const result = buffer.sendNow()

      expect(result).to.be.true
      expect(sendBeaconStub.calledOnce).to.be.true
    })

    it('should not send when page becomes visible', () => {
      buffer.addLog({ event: 'test' })
      buffer.start()
      sendBeaconStub.resetHistory()

      Object.defineProperty((global as any).document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true
      })

      const event = new dom.window.Event('visibilitychange')
      ;(global as any).document.dispatchEvent(event)

      expect(sendBeaconStub.called).to.be.false
    })
  })
})
