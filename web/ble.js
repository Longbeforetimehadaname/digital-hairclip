// Dünne Hülle um Web Bluetooth. Funktioniert in Chrome (Android, Desktop) und in der iOS-App „Bluefy“.
import { SERVICE_UUID, RX_UUID, DEVICE_NAME_PREFIX, chunks } from './protocol.js';

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

  // Schreibt mit Antwort: Der Clip bestätigt jedes Stück, dadurch kann er nicht überrannt werden.
  // Stücke bis 180 Bytes gehen auch bei kleiner Verbindungsgrösse (MTU) als „Long Write“ durch.
  // Noch nicht mit echter Hardware gemessen: Wenn es zu langsam ist oder abbricht, CHUNK in protocol.js anpassen.
  async send(bytes, onProgress = () => {}) {
    if (!this.connected) throw new Error('NOT_CONNECTED');
    if (this.busy) throw new Error('BUSY');
    this.busy = true;
    try {
      let sent = 0;
      for (const part of chunks(bytes)) {
        if (this.rx.writeValueWithResponse) await this.rx.writeValueWithResponse(part);
        else await this.rx.writeValue(part);
        sent += part.length;
        onProgress(sent / bytes.length);
      }
    } finally {
      this.busy = false;
    }
  }
}
