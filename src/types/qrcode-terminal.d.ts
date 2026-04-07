declare module 'qrcode-terminal' {
  export interface QrOptions {
    small?: boolean;
  }

  export interface QrcodeTerminal {
    generate(qr: string, options?: QrOptions): void;
  }

  const qrcodeTerminal: QrcodeTerminal;
  export default qrcodeTerminal;
}
