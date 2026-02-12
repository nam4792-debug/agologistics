import type { DeviceInfo } from '../types/electron';

/**
 * Get device information (ID, name, OS)
 * Uses Electron IPC to get hardware fingerprint from main process
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
    // Check if running in Electron
    if (window.electronAPI) {
        return await window.electronAPI.getDeviceInfo();
    }

    // Fallback for browser (development/testing)
    console.warn('Not running in Electron, using mock device ID');
    return {
        deviceId: 'browser-mock-device-id',
        deviceName: 'Browser',
        osInfo: navigator.userAgent,
    };
}

/**
 * Get device ID only
 */
export async function getDeviceId(): Promise<string> {
    const info = await getDeviceInfo();
    return info.deviceId;
}

// Cache device info in session storage
const DEVICE_INFO_KEY = 'logispro_device_info';

export async function getCachedDeviceInfo(): Promise<DeviceInfo> {
    try {
        const cached = sessionStorage.getItem(DEVICE_INFO_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        console.error('Failed to get cached device info:', err);
    }

    const info = await getDeviceInfo();

    try {
        sessionStorage.setItem(DEVICE_INFO_KEY, JSON.stringify(info));
    } catch (err) {
        console.error('Failed to cache device info:', err);
    }

    return info;
}
