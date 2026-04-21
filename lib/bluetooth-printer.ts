/**
 * Bluetooth Thermal Printer Library
 * 
 * Supports ESC/POS compatible thermal printers via Web Bluetooth API.
 * Common printers: Epson TM series, Star Micronics, and generic 58mm/80mm printers.
 * 
 * Paper width: 58mm = 32 chars, 80mm = 48 chars
 */

// Paper width in characters - 58mm thermal paper (most common for kitchen printers)
const PAPER_WIDTH = 32

// ESC/POS Commands
const ESC = 0x1B
const GS = 0x1D
const LF = 0x0A

const COMMANDS = {
  // Initialize printer
  INIT: new Uint8Array([ESC, 0x40]),
  
  // Text alignment
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  
  // Text formatting
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT_ON: new Uint8Array([ESC, 0x21, 0x10]),
  DOUBLE_WIDTH_ON: new Uint8Array([GS, 0x21, 0x20]),
  DOUBLE_SIZE_ON: new Uint8Array([ESC, 0x21, 0x30]),
  NORMAL_SIZE: new Uint8Array([ESC, 0x21, 0x00]),
  UNDERLINE_ON: new Uint8Array([ESC, 0x2D, 0x01]),
  UNDERLINE_OFF: new Uint8Array([ESC, 0x2D, 0x00]),
  
  // Line spacing
  LINE_SPACING_DEFAULT: new Uint8Array([ESC, 0x32]),
  LINE_SPACING_TIGHT: new Uint8Array([ESC, 0x33, 24]),
  
  // Cut paper
  PARTIAL_CUT: new Uint8Array([GS, 0x56, 0x41, 0x10]),
  FULL_CUT: new Uint8Array([GS, 0x56, 0x00]),
  
  // Feed paper
  FEED_LINE: new Uint8Array([LF]),
  FEED_LINES_2: new Uint8Array([ESC, 0x64, 0x02]),
  FEED_LINES_3: new Uint8Array([ESC, 0x64, 0x03]),
  FEED_LINES_5: new Uint8Array([ESC, 0x64, 0x05]),
  
  // Beep (if supported)
  BEEP: new Uint8Array([ESC, 0x42, 0x03, 0x02]),
}

// Helper functions for receipt formatting
function centerText(text: string): string {
  const pad = Math.max(0, Math.floor((PAPER_WIDTH - text.length) / 2))
  return ' '.repeat(pad) + text
}

function leftRightText(left: string, right: string): string {
  const space = PAPER_WIDTH - left.length - right.length
  return left + ' '.repeat(Math.max(1, space)) + right
}

function wrapText(text: string, width: number = PAPER_WIDTH): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  words.forEach(word => {
    if ((current + ' ' + word).trim().length <= width) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  })
  if (current) lines.push(current)
  return lines
}

function getCustomerInitials(name: string): string {
  if (!name) return ''
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0].toUpperCase() + '.')
    .join('')
}

// Bluetooth printer service UUIDs (common ones)
const PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Generic printer service
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Star Micronics
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Nordic UART
  "0000ff00-0000-1000-8000-00805f9b34fb", // Generic Chinese printers (PX-90B, etc)
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10/CC2541 BLE module
  "00001101-0000-1000-8000-00805f9b34fb", // SPP (Serial Port Profile)
]

const PRINTER_CHARACTERISTIC_UUIDS = [
  "00002af1-0000-1000-8000-00805f9b34fb", // Generic write
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f", // Star Micronics
  "49535343-8841-43f4-a8d4-ecbe34729bb3", // Nordic UART TX
  "0000ff02-0000-1000-8000-00805f9b34fb", // Chinese printers write
  "0000ffe1-0000-1000-8000-00805f9b34fb", // HM-10/CC2541 characteristic
]

export type PrinterStatus = {
  connected: boolean
  name: string | null
  id: string | null
}

type Order = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  delivery_type: string
  delivery_address?: string
  delivery_city?: string
  delivery_state?: string
  delivery_zip?: string
  delivery_date: string
  special_instructions?: string
  total: number
  created_at: string
  order_items: Array<{
    id: string
    item_name: string
    quantity: number
    selected_options?: any
  }>
}

class BluetoothPrinter {
  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private encoder: TextEncoder = new TextEncoder()

  /**
   * Check if Web Bluetooth is supported
   */
  isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator
  }

  /**
   * Get current printer status
   */
  getStatus(): PrinterStatus {
    return {
      connected: this.device?.gatt?.connected || false,
      name: this.device?.name || null,
      id: this.device?.id || null,
    }
  }

  /**
   * Connect to a Bluetooth printer
   */
  async connect(): Promise<{ success: boolean; error?: string; printer?: PrinterStatus }> {
    if (!this.isSupported()) {
      return { success: false, error: "Web Bluetooth no está soportado en este navegador" }
    }

    try {
      // Request device - use acceptAllDevices for maximum compatibility
      // Filter to show only thermal receipt printers by name prefix
      // This reduces picker clutter by hiding phones, headphones, etc.
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "NT-" },      // NT-POS80-BS and similar
          { namePrefix: "POS" },      // Generic POS printers
          { namePrefix: "Printer" },  // Generic printer names
          { namePrefix: "TM-" },      // Epson TM series
          { namePrefix: "TSP" },      // Star TSP series
          { namePrefix: "mPOP" },     // Star mPOP
          { namePrefix: "BT-" },      // Generic Bluetooth printers
          { namePrefix: "Zebra" },    // Zebra printers
          { namePrefix: "ZD" },       // Zebra ZD series
          { namePrefix: "ZQ" },       // Zebra ZQ mobile series
          { namePrefix: "MUNBYN" },   // Munbyn printers
          { namePrefix: "MU-" },      // Munbyn alternate prefix
          { namePrefix: "Star" },     // Star printers
          { namePrefix: "SM-" },      // Star SM series
          { namePrefix: "SP-" },      // Star SP series
        ],
        optionalServices: PRINTER_SERVICE_UUIDS,
      })

      if (!this.device) {
        return { success: false, error: "No se seleccionó ninguna impresora" }
      }

      console.log("[BT Printer] Device selected:", this.device.name, this.device.id)

      // Connect to GATT server
      const server = await this.device.gatt?.connect()
      if (!server) {
        return { success: false, error: "No se pudo conectar al servidor GATT" }
      }
      console.log("[BT Printer] GATT connected")

      // Get all services to discover what's available
      const allServices = await server.getPrimaryServices()
      console.log("[BT Printer] Available services:", allServices.map(s => s.uuid))

      // Find the write characteristic from known UUIDs first
      for (const serviceUUID of PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUUID)
          console.log("[BT Printer] Found known service:", serviceUUID)
          for (const charUUID of PRINTER_CHARACTERISTIC_UUIDS) {
            try {
              this.characteristic = await service.getCharacteristic(charUUID)
              console.log("[BT Printer] Found known characteristic:", charUUID)
              if (this.characteristic) break
            } catch {
              continue
            }
          }
          if (this.characteristic) break
        } catch {
          continue
        }
      }

      // If no known characteristic found, try ALL services for any writable characteristic
      if (!this.characteristic) {
        console.log("[BT Printer] No known characteristic, scanning all services...")
        for (const service of allServices) {
          try {
            const characteristics = await service.getCharacteristics()
            console.log("[BT Printer] Service", service.uuid, "has characteristics:", 
              characteristics.map(c => ({ uuid: c.uuid, write: c.properties.write, writeNoResp: c.properties.writeWithoutResponse })))
            
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                this.characteristic = char
                console.log("[BT Printer] Using writable characteristic:", char.uuid)
                break
              }
            }
            if (this.characteristic) break
          } catch (e) {
            console.log("[BT Printer] Error getting characteristics for service", service.uuid, e)
          }
        }
      }

      if (!this.characteristic) {
        return { success: false, error: "No se encontró característica de escritura" }
      }

      // Store device ID for reconnection
      if (typeof localStorage !== "undefined" && this.device.id) {
        localStorage.setItem("bt_printer_id", this.device.id)
        localStorage.setItem("bt_printer_name", this.device.name || "")
      }

      return { 
        success: true, 
        printer: this.getStatus() 
      }
    } catch (error: any) {
      console.error("[Bluetooth Printer] Connection error:", error)
      return { 
        success: false, 
        error: error.message || "Error al conectar con la impresora" 
      }
    }
  }

  /**
   * Try to reconnect to a previously paired printer
   * Uses the Web Bluetooth getDevices() API available in Chrome 85+
   * Falls back to requestDevice() if getDevices() fails
   */
  async tryReconnect(): Promise<{ success: boolean; error?: string; printer?: PrinterStatus; needsManualConnect?: boolean }> {
    if (!this.isSupported()) {
      return { success: false, error: "Web Bluetooth no soportado" }
    }

    const savedId = typeof localStorage !== "undefined" ? localStorage.getItem("bt_printer_id") : null
    const savedName = typeof localStorage !== "undefined" ? localStorage.getItem("bt_printer_name") : null
    
    if (!savedId) {
      return { success: false, error: "No hay impresora guardada" }
    }

    // Try getDevices() first (Chrome 85+, desktop only - not available on Android)
    if ('getDevices' in navigator.bluetooth) {
      try {
        const devices = await (navigator.bluetooth as any).getDevices()
        const savedDevice = devices.find((d: BluetoothDevice) => d.id === savedId)
        
        if (savedDevice) {
          this.device = savedDevice
          
          // Connect to GATT server
          const server = await this.device.gatt?.connect()
          if (server) {
            // Find writable characteristic
            const allServices = await server.getPrimaryServices()
            for (const serviceUUID of PRINTER_SERVICE_UUIDS) {
              try {
                const service = await server.getPrimaryService(serviceUUID)
                for (const charUUID of PRINTER_CHARACTERISTIC_UUIDS) {
                  try {
                    this.characteristic = await service.getCharacteristic(charUUID)
                    if (this.characteristic) break
                  } catch { continue }
                }
                if (this.characteristic) break
              } catch { continue }
            }

            // Try any writable characteristic
            if (!this.characteristic) {
              for (const service of allServices) {
                try {
                  const chars = await service.getCharacteristics()
                  for (const char of chars) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                      this.characteristic = char
                      break
                    }
                  }
                  if (this.characteristic) break
                } catch { continue }
              }
            }

            if (this.characteristic) {
              return { success: true, printer: this.getStatus() }
            }
          }
        }
      } catch {
        // getDevices() failed, continue to fallback
      }
    }

    // If getDevices() didn't work, inform user they need to manually select
    // This happens after PWA restart, page refresh, or browser restart
    return { 
      success: false, 
      error: `Selecciona "${savedName || 'la impresora'}" en la lista para reconectar`,
      needsManualConnect: true
    }
  }

  /**
   * Check if there's a saved printer to reconnect to
   */
  hasSavedPrinter(): { hasPrinter: boolean; name: string | null } {
    if (typeof localStorage === "undefined") {
      return { hasPrinter: false, name: null }
    }
    const id = localStorage.getItem("bt_printer_id")
    const name = localStorage.getItem("bt_printer_name")
    return { hasPrinter: !!id, name }
  }

  /**
   * Clear saved printer
   */
  clearSavedPrinter(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("bt_printer_id")
      localStorage.removeItem("bt_printer_name")
    }
  }

  /**
   * Disconnect from printer
   */
  disconnect(): void {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect()
    }
    this.device = null
    this.characteristic = null
  }

  /**
   * Write raw data to printer
   */
  private async write(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error("Impresora no conectada")
    }

    // Some printers have a max packet size, send in chunks
    const chunkSize = 100
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk)
      } else {
        await this.characteristic.writeValue(chunk)
      }
      // Small delay between chunks
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  /**
   * Print text with encoding
   */
  private async printText(text: string): Promise<void> {
    const encoded = this.encoder.encode(text)
    await this.write(encoded)
  }

  /**
   * Print an order receipt
   */
  async printReceipt(order: Order, restaurantName: string): Promise<{ success: boolean; error?: string }> {
    if (!this.characteristic) {
      return { success: false, error: "Impresora no conectada" }
    }

    try {
      // Initialize printer
      await this.write(COMMANDS.INIT)

      // Header - Restaurant name
      await this.write(COMMANDS.ALIGN_CENTER)
      await this.write(COMMANDS.DOUBLE_SIZE_ON)
      await this.printText(`${restaurantName}\n`)
      await this.write(COMMANDS.NORMAL_SIZE)
      await this.write(COMMANDS.FEED_LINE)

      // Order number
      await this.write(COMMANDS.DOUBLE_SIZE_ON)
      await this.printText(`ORDEN #${order.order_number}\n`)
      await this.write(COMMANDS.NORMAL_SIZE)
      await this.write(COMMANDS.FEED_LINE)

      // Separator
      await this.printText("================================\n")

      // Order type badge
      await this.write(COMMANDS.ALIGN_LEFT)
      await this.write(COMMANDS.BOLD_ON)
      const orderType = order.delivery_type === "delivery" ? "** DELIVERY **" : "** PICKUP **"
      await this.printText(`${orderType}\n`)
      await this.write(COMMANDS.BOLD_OFF)
      await this.write(COMMANDS.FEED_LINE)

      // Customer info (phone omitted for privacy)
      await this.printText(`Cliente: ${order.customer_name}\n`)
      
      if (order.delivery_type === "delivery" && order.delivery_address) {
        await this.printText(`Direccion:\n`)
        await this.printText(`  ${order.delivery_address}\n`)
        if (order.delivery_city) {
          await this.printText(`  ${order.delivery_city}, ${order.delivery_state} ${order.delivery_zip}\n`)
        }
      }

      // Delivery date
      const deliveryDate = new Date(order.delivery_date)
      await this.printText(`Fecha: ${new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico" }).format(deliveryDate)}\n`)
      await this.write(COMMANDS.FEED_LINE)

      // Separator
      await this.printText("--------------------------------\n")
      await this.write(COMMANDS.BOLD_ON)
      await this.printText("ITEMS:\n")
      await this.write(COMMANDS.BOLD_OFF)
      await this.printText("--------------------------------\n")

      // Order items
      for (const item of order.order_items) {
        await this.write(COMMANDS.BOLD_ON)
        await this.printText(`${item.quantity}x ${item.item_name}\n`)
        await this.write(COMMANDS.BOLD_OFF)

        // Options
        if (item.selected_options && Object.keys(item.selected_options).length > 0) {
          for (const [key, value] of Object.entries(item.selected_options)) {
            const optValue = Array.isArray(value) ? value.join(", ") : String(value)
            await this.printText(`   > ${optValue}\n`)
          }
        }
      }

      await this.write(COMMANDS.FEED_LINE)

      // Special instructions
      if (order.special_instructions) {
        await this.printText("--------------------------------\n")
        await this.write(COMMANDS.BOLD_ON)
        await this.printText("INSTRUCCIONES:\n")
        await this.write(COMMANDS.BOLD_OFF)
        await this.printText(`${order.special_instructions}\n`)
        await this.write(COMMANDS.FEED_LINE)
      }

      // Separator
      await this.printText("================================\n")

      // Total
      await this.write(COMMANDS.ALIGN_RIGHT)
      await this.write(COMMANDS.DOUBLE_SIZE_ON)
      await this.printText(`TOTAL: $${order.total.toFixed(2)}\n`)
      await this.write(COMMANDS.NORMAL_SIZE)
      await this.write(COMMANDS.ALIGN_LEFT)

      // Footer
      await this.write(COMMANDS.FEED_LINE)
      await this.write(COMMANDS.ALIGN_CENTER)
      const orderTime = new Date(order.created_at)
      await this.printText(`Ordenado: ${new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }).format(orderTime)}\n`)
      await this.printText(`Impreso: ${new Intl.DateTimeFormat("es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }).format(new Date())}\n`)

      // Feed and cut
      await this.write(COMMANDS.FEED_LINES_5)
      await this.write(COMMANDS.PARTIAL_CUT)

      return { success: true }
    } catch (error: any) {
      console.error("[Bluetooth Printer] Print error:", error)
      return { success: false, error: error.message || "Error al imprimir" }
    }
  }

  /**
   * Print a KDS kitchen ticket with FOODNETPR branding
   * Uses 58mm paper (32 chars width) - Paper-efficient layout
   */
  async printKitchenTicket(order: Order, restaurantName: string, branchName?: string | null): Promise<{ success: boolean; error?: string }> {
    if (!this.characteristic) {
      return { success: false, error: "Impresora no conectada" }
    }

    try {
      // Initialize printer
      await this.write(COMMANDS.INIT)

      // Beep for attention (if supported)
      await this.write(COMMANDS.BEEP)

      // --- NUEVA ORDEN (large, bold, centered) - most important for kitchen ---
      await this.write(COMMANDS.ALIGN_CENTER)
      await this.write(COMMANDS.DOUBLE_SIZE_ON)
      await this.write(COMMANDS.BOLD_ON)
      await this.printText("NUEVA ORDEN\n")
      await this.write(COMMANDS.NORMAL_SIZE)
      await this.write(COMMANDS.BOLD_OFF)

      // --- FOODNETPR + restaurant on same block, no blank lines ---
      await this.write(COMMANDS.DOUBLE_HEIGHT_ON)
      await this.write(COMMANDS.BOLD_ON)
      await this.printText(centerText("FOODNETPR") + "\n")
      await this.write(COMMANDS.NORMAL_SIZE)
      await this.write(COMMANDS.BOLD_OFF)
      await this.write(COMMANDS.ALIGN_LEFT)
      await this.write(COMMANDS.BOLD_ON)
      await this.printText(restaurantName.toUpperCase() + "\n")
      await this.write(COMMANDS.BOLD_OFF)
      if (branchName) {
        await this.printText(branchName + "\n")
      }

      // --- ORDER NUMBER ---
      await this.printText("-".repeat(PAPER_WIDTH) + "\n")
      await this.write(COMMANDS.ALIGN_CENTER)
      await this.write(COMMANDS.DOUBLE_SIZE_ON)
      await this.write(COMMANDS.BOLD_ON)
      await this.printText(`#${order.order_number}\n`)
      await this.write(COMMANDS.NORMAL_SIZE)
      await this.write(COMMANDS.BOLD_OFF)

      // --- ORDER META (compact, all on consecutive lines) ---
      await this.write(COMMANDS.ALIGN_LEFT)
      const date = new Date(order.created_at)
      const dateStr = new Intl.DateTimeFormat('es-PR', {
        timeZone: 'America/Puerto_Rico',
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(date)
      const timeStr = new Intl.DateTimeFormat('es-PR', {
        timeZone: 'America/Puerto_Rico',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).format(date)
      await this.printText(leftRightText("Fecha:", dateStr) + "\n")
      await this.printText(leftRightText("Hora:", timeStr) + "\n")
      const orderTypeLabel = order.delivery_type === "delivery" ? "DELIVERY" : "PICKUP"
      await this.printText(leftRightText("Tipo:", orderTypeLabel) + "\n")

      // Customer initials only (phone omitted for privacy)
      if (order.customer_name) {
        const initials = getCustomerInitials(order.customer_name)
        await this.printText(leftRightText("Cliente:", initials) + "\n")
      }

      // --- ITEMS (single blank line between items for readability) ---
      await this.printText("-".repeat(PAPER_WIDTH) + "\n")
      await this.write(COMMANDS.BOLD_ON)
      await this.printText("ITEMS:\n")
      await this.write(COMMANDS.BOLD_OFF)

      for (let i = 0; i < order.order_items.length; i++) {
        const item = order.order_items[i]
        
        // Thin separator between items (not before first)
        if (i > 0) {
          await this.printText("\n") // Single blank line between items
        }

        // Item name + quantity (bold)
        await this.write(COMMANDS.BOLD_ON)
        await this.printText(`${item.quantity}x ${item.item_name.toUpperCase()}\n`)
        await this.write(COMMANDS.BOLD_OFF)

        // Modifiers/options - immediately after item, no gap
        if (item.selected_options && Object.keys(item.selected_options).length > 0) {
          for (const [, value] of Object.entries(item.selected_options)) {
            if (value) {
              const optValue = Array.isArray(value) ? value.join(", ") : String(value)
              if (optValue && optValue !== "undefined") {
                await this.printText(`  >${optValue}\n`)
              }
            }
          }
        }

        // Per-item special instructions (bold+underline, with ! prefix)
        const itemInstructions = (item as any).special_instructions
        if (itemInstructions) {
          await this.write(COMMANDS.BOLD_ON)
          await this.write(COMMANDS.UNDERLINE_ON)
          await this.printText(`  !${itemInstructions.toUpperCase()}\n`)
          await this.write(COMMANDS.UNDERLINE_OFF)
          await this.write(COMMANDS.BOLD_OFF)
        }
      }

      // --- ORDER NOTES - inline, bold+underline, no wasted lines ---
      if (order.special_instructions) {
        await this.printText("-".repeat(PAPER_WIDTH) + "\n")
        await this.write(COMMANDS.BOLD_ON)
        await this.write(COMMANDS.UNDERLINE_ON)
        await this.printText("!NOTAS:\n")
        await this.write(COMMANDS.UNDERLINE_OFF)
        const wrappedNotes = wrapText(order.special_instructions.toUpperCase())
        for (const line of wrappedNotes) {
          await this.printText(line + "\n")
        }
        await this.write(COMMANDS.BOLD_OFF)
      }

      // --- FOOTER (minimal) ---
      await this.printText("-".repeat(PAPER_WIDTH) + "\n")
      await this.write(COMMANDS.ALIGN_LEFT)
      await this.printText(leftRightText("foodnetpr.com", "787-520-5188") + "\n")

      // Minimal feed before cut - just enough to clear tear bar
      await this.write(COMMANDS.FEED_LINES_2)
      await this.write(COMMANDS.PARTIAL_CUT)

      return { success: true }
    } catch (error: any) {
      console.error("[Bluetooth Printer] Kitchen ticket error:", error)
      return { success: false, error: error.message || "Error al imprimir" }
    }
  }

  /**
   * Test print
   */
  async testPrint(): Promise<{ success: boolean; error?: string }> {
    if (!this.characteristic) {
      return { success: false, error: "Impresora no conectada" }
    }

    try {
      await this.write(COMMANDS.INIT)
      await this.write(COMMANDS.ALIGN_CENTER)
      await this.write(COMMANDS.DOUBLE_SIZE_ON)
      await this.printText("TEST PRINT\n")
      await this.write(COMMANDS.NORMAL_SIZE)
      await this.write(COMMANDS.FEED_LINE)
      await this.printText("Impresora conectada correctamente!\n")
      await this.printText(`${new Date().toLocaleString("es-PR")}\n`)
      await this.write(COMMANDS.FEED_LINES_3)
      await this.write(COMMANDS.PARTIAL_CUT)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || "Error en prueba de impresion" }
    }
  }
}

// Singleton instance
export const bluetoothPrinter = new BluetoothPrinter()
