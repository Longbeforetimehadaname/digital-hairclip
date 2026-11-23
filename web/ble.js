// Dünne Hülle um Web Bluetooth. Funktioniert in Chrome (Android, Desktop) und in der iOS-App „Bluefy“.
import { SERVICE_UUID, RX_UUID, DEVICE_NAME_PREFIX, chunks } from './protocol.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class HairclipLink {
  constructor({ onChange } = {}) {
    this.onChange = onChange || (() => {});
    this.device = null;
    this.rx = null;
    this.busy = false;
  }

  static get supported() {
    return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
  }

  get connected() {
    return Boolean(this.device && this.device.gatt && this.device.gatt.connected && this.rx);
  }

  // Muss durch einen Tipp/Klick ausgelöst werden, sonst blockiert der Browser die Geräteauswahl.
  async connect() {
    if (!HairclipLink.supported) throw new Error('NO_WEB_BLUETOOTH');
    if (this.connected) return;
    if (!this.device) {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
        optionalServices: [SERVICE_UUID],
      });
      this.device.addEventListener('gattserverdisconnected', () => {
        this.rx = null;
        this.onChange();
      });
    }
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    this.rx = await service.getCharacteristic(RX_UUID);
    this.onChange();
  }

  disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) this.device.gatt.disconnect();
    this.rx = null;
    this.onChange();
  }

  async send(bytes, onProgress = () => {}) {
    if (!this.connected) throw new Error('NOT_CONNECTED');
    if (this.busy) throw new Error('BUSY');
    this.busy = true;
    try {
      let sent = 0;
      let writes = 0;
      for (const part of chunks(bytes, 20)) {
        if (this.rx.writeValueWithoutResponse) await this.rx.writeValueWithoutResponse(part);
        else await this.rx.writeValue(part);
        sent += part.length;
        writes += 1;
        onProgress(sent / bytes.length);
        if (writes % 8 === 0) await sleep(6); // dem kleinen Chip Zeit zum Verarbeiten lassen
      }
    } finally {
      this.busy = false;
    }
  }
}
