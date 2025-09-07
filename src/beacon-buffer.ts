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
  enableSendLock?: boolean
  sendTimeout?: number
  retryOnFailure?: boolean
  maxBufferSize?: number
  enableAutoSend?: boolean
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
  enableSendLock: boolean
  sendTimeout: number
  retryOnFailure: boolean
  maxBufferSize: number
  enableAutoSend: boolean
}

const DEFAULT_SEND_INTERVAL = 20000
const DEFAULT_BUFFER_KEY = 'beaconBuffer'
const DEFAULT_DATA_KEY = 'logs'
const DEFAULT_SEND_TIMEOUT = 30000
const DEFAULT_MAX_BUFFER_SIZE = 50 * 1024 // 50KB
const CONTENT_TYPE_JSON = 'application/json; charset=UTF-8'

class BeaconBuffer {
  private settings: Settings
  private sendIntervalId: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private isSending: boolean = false
  private sendingData: LogData[] | null = null
  private sendTimeoutId: NodeJS.Timeout | null = null
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
      autoStart: config.autoStart || false,
      enableSendLock: config.enableSendLock !== false, // Default true
      sendTimeout: config.sendTimeout || DEFAULT_SEND_TIMEOUT,
      retryOnFailure: config.retryOnFailure || false,
      maxBufferSize: config.maxBufferSize || DEFAULT_MAX_BUFFER_SIZE,
      enableAutoSend: config.enableAutoSend !== false // Default true
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

  private calculateCurrentBufferSize(): number {
    const buffer = this.getBuffer()
    if (buffer.length === 0) return 0
    
    const dataToSend = this.prepareDataForSending(buffer)
    const jsonString = JSON.stringify(dataToSend)
    return new Blob([jsonString]).size
  }

  // Public buffer operations
  addLog(logData: LogData): void {
    if (!logData) return
    const buffer = this.getBuffer()
    buffer.push({ ...logData, timestamp: new Date().toISOString() })
    this.saveBuffer(buffer)
    
    // Check buffer size and auto-send if enabled and over threshold
    if (this.settings.enableAutoSend && this.isRunning && !this.isSending) {
      const currentSize = this.calculateCurrentBufferSize()
      if (currentSize >= this.settings.maxBufferSize) {
        this.sendNow()
      }
    }
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
    // Check if lock is enabled and already sending
    if (this.settings.enableSendLock && this.isSending) {
      return false
    }

    const buffer = this.getBuffer()
    if (buffer.length === 0) {
      return false
    }

    // Acquire lock if enabled
    if (this.settings.enableSendLock) {
      this.isSending = true
      this.startSendTimeout()
    }
    
    try {
      // Copy buffer for atomic sending
      this.sendingData = [...buffer]
      
      const dataToSend = this.prepareDataForSending(this.sendingData)
      const blob = this.createJsonBlob(dataToSend)

      const success = navigator.sendBeacon(this.settings.endpointUrl, blob)
      
      if (success) {
        // Remove only sent data from buffer
        this.removeSentDataFromBuffer()
        this.clearSendTimeout()
        return true
      } else {
        console.error('Failed to send data with sendBeacon')
        
        // Retry if configured
        if (this.settings.retryOnFailure) {
          // Release lock temporarily for retry
          if (this.settings.enableSendLock) {
            this.isSending = false
            this.clearSendTimeout()
          }
          // Retry once
          return this.sendNow()
        }
        
        // Data remains in buffer on failure
        this.clearSendTimeout()
        return false
      }
    } finally {
      // Always release lock if enabled
      if (this.settings.enableSendLock) {
        this.sendingData = null
        this.isSending = false
        this.clearSendTimeout()
      }
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

  private removeSentDataFromBuffer(): void {
    if (!this.sendingData) return
    
    const currentBuffer = this.getBuffer()
    const sentCount = this.sendingData.length
    
    // Remove sent items from the beginning of the buffer
    // This preserves any new items added during sending
    const newBuffer = currentBuffer.slice(sentCount)
    
    if (newBuffer.length > 0) {
      this.saveBuffer(newBuffer)
    } else {
      this.clearBuffer()
    }
  }

  private startSendTimeout(): void {
    if (!this.settings.sendTimeout) return
    
    this.sendTimeoutId = setTimeout(() => {
      console.error(`Send timeout after ${this.settings.sendTimeout}ms`)
      // Force release lock
      this.isSending = false
      this.sendingData = null
      this.sendTimeoutId = null
    }, this.settings.sendTimeout)
  }

  private clearSendTimeout(): void {
    if (this.sendTimeoutId) {
      clearTimeout(this.sendTimeoutId)
      this.sendTimeoutId = null
    }
  }

  // Lifecycle management
  start(): void {
    if (this.isRunning) {
      return
    }

    this.attachEventListeners()
    this.startPeriodicSending()
    this.sendNow()

    this.isRunning = true
  }

  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.removeEventListeners()
    this.stopPeriodicSending()

    this.isRunning = false
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
