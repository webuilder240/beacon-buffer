/**
 * Beacon Buffer - A generic buffer library for sending data using the Beacon API
 * Functional API design using TypeScript
 */

// Type definitions
export interface BeaconBufferConfig {
  endpointUrl: string
  sendInterval?: number
  headers?: Record<string, string>
  bufferKey?: string
  dataKey?: string
  autoStart?: boolean
}

export interface LogData {
  [key: string]: any
  timestamp?: string
}

interface Settings {
  endpointUrl: string
  sendInterval: number
  headers: Record<string, string>
  bufferKey: string
  dataKey: string
  autoStart: boolean
}

const DEFAULT_SEND_INTERVAL = 20000
const DEFAULT_BUFFER_KEY = 'beaconBuffer'
const DEFAULT_DATA_KEY = 'logs'
const CONTENT_TYPE_JSON = 'application/json; charset=UTF-8'

class BeaconBuffer {
  private settings: Settings
  private sendIntervalId: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private visibilityHandler!: () => void
  private boundSendNow!: () => boolean

  constructor(config: BeaconBufferConfig) {
    this.validateConfig(config)
    this.settings = this.buildSettings(config)
    this.initializeEventHandlers()
    
    if (this.settings.autoStart) {
      this.start()
    }
  }

  // Configuration and initialization
  private validateConfig(config: BeaconBufferConfig): void {
    if (!config || !config.endpointUrl) {
      throw new Error('endpointUrl is required in configuration')
    }
  }

  private buildSettings(config: BeaconBufferConfig): Settings {
    return {
      endpointUrl: config.endpointUrl,
      sendInterval: config.sendInterval || DEFAULT_SEND_INTERVAL,
      headers: config.headers || {},
      bufferKey: config.bufferKey || DEFAULT_BUFFER_KEY,
      dataKey: config.dataKey || DEFAULT_DATA_KEY,
      autoStart: config.autoStart || false
    }
  }

  private initializeEventHandlers(): void {
    this.boundSendNow = this.sendNow.bind(this)
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.sendNow()
      }
    }
  }

  // Storage operations
  private saveBuffer(data: LogData[]): void {
    try {
      localStorage.setItem(this.settings.bufferKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save buffer to localStorage:', error)
    }
  }

  // Public buffer operations
  addLog(logData: LogData): void {
    if (!logData) return
    const buffer = this.getBuffer()
    buffer.push({ ...logData, timestamp: new Date().toISOString() })
    this.saveBuffer(buffer)
  }

  getBuffer(): LogData[] {
    try {
      const bufferedData = localStorage.getItem(this.settings.bufferKey)
      return bufferedData ? JSON.parse(bufferedData) : []
    } catch (error) {
      console.error('Failed to get buffer from localStorage:', error)
      return []
    }
  }

  clearBuffer(): void {
    try {
      localStorage.removeItem(this.settings.bufferKey)
    } catch (error) {
      console.error('Failed to clear buffer from localStorage:', error)
    }
  }

  // Data sending operations
  sendNow(): boolean {
    const buffer = this.getBuffer()
    if (buffer.length === 0) {
      return false
    }

    const dataToSend = this.prepareDataForSending(buffer)
    const blob = this.createJsonBlob(dataToSend)

    if (navigator.sendBeacon(this.settings.endpointUrl, blob)) {
      this.clearBuffer()
      console.log(`Buffered data sent successfully to ${this.settings.endpointUrl}`)
      return true
    } else {
      console.error('Failed to send data with sendBeacon')
      return false
    }
  }

  private prepareDataForSending(buffer: LogData[]): Record<string, any> {
    return {
      ...this.settings.headers,
      [this.settings.dataKey]: buffer
    }
  }

  private createJsonBlob(data: Record<string, any>): Blob {
    return new Blob([JSON.stringify(data)], {
      type: CONTENT_TYPE_JSON
    })
  }

  // Lifecycle management
  start(): void {
    if (this.isRunning) {
      console.warn('Beacon buffer is already started')
      return
    }

    this.attachEventListeners()
    this.startPeriodicSending()
    this.sendNow()

    this.isRunning = true
    console.log(`Beacon buffer started with interval: ${this.settings.sendInterval}ms`)
  }

  stop(): void {
    if (!this.isRunning) {
      console.warn('Beacon buffer is not started')
      return
    }

    this.removeEventListeners()
    this.stopPeriodicSending()

    this.isRunning = false
    console.log('Beacon buffer stopped')
  }

  // Event management
  private attachEventListeners(): void {
    window.addEventListener('beforeunload', this.boundSendNow)
    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  private removeEventListeners(): void {
    window.removeEventListener('beforeunload', this.boundSendNow)
    document.removeEventListener('visibilitychange', this.visibilityHandler)
  }

  // Periodic sending management
  private startPeriodicSending(): void {
    if (this.sendIntervalId) {
      clearInterval(this.sendIntervalId)
    }
    this.sendIntervalId = setInterval(() => this.sendNow(), this.settings.sendInterval)
  }

  private stopPeriodicSending(): void {
    if (this.sendIntervalId) {
      clearInterval(this.sendIntervalId)
      this.sendIntervalId = null
    }
  }

  // Configuration access
  getConfig(): Settings {
    return { ...this.settings }
  }

  isStarted(): boolean {
    return this.isRunning
  }
}

export default BeaconBuffer
