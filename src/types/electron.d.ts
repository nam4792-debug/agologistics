// Type definitions for Electron API exposed via preload
export interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    osInfo: string;
}

export interface ElectronAPI {
    getDeviceInfo: () => Promise<DeviceInfo>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export { };
