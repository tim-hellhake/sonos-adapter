/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

import { Adapter, Database } from 'gateway-addon';
import { DeviceDiscovery, Sonos, Discovery } from 'sonos';
import { Speaker } from './speaker';

//TODO cache state

export class SonosAdapter extends Adapter {
    private deviceDiscovery?: Discovery;

    constructor(addonManager: any, packageName: any) {
        super(addonManager, 'SonosAdapter', packageName);
        addonManager.addAdapter(this);

        const db = new Database(packageName);
        db.open().then(() => {
            return db.loadConfig();
        }).then((config) => {
            if (config && config.addresses) {
                for (const addr of config.addresses) {
                    const device = new Sonos(addr);
                    this.addDevice(device).catch(console.warn);
                }
            }

            db.close();
        }).catch((e) => {
            console.error('Failed to open database:', e);
        }).then(() => {
            DeviceDiscovery({
                timeout: 20000
            }, (device: any) => {
                this.addDevice(device).catch(console.warn);
            });
        });
    }

    /**
    * @param {SonosDevice} device Sonos device to add.
    * @return {Promise} which resolves to the device added.
    */
    async addDevice(device: any) {
        const deviceDescription = await device.deviceDescription();
        if (deviceDescription.serialNum in this.devices) {
            throw 'Device: ' + deviceDescription.serialNum + ' already exists.';
        }
        else {
            // Don't try to add BRIDGEs
            //TODO should also avoid adding BOOSTs
            if (deviceDescription.zoneType != '4') {
                const speaker = new Speaker(this, deviceDescription.serialNum, device);
                return speaker.ready;
            }
        }
    }

    /**
    * @param {String} deviceId ID of the device to remove.
    */
    removeDevice(deviceId: string) {
        const device = this.devices[deviceId];
        if (device) {
            this.handleDeviceRemoved(device);
        }
        else {
            throw new Error('Device: ' + deviceId + ' not found.');
        }
    }

    /**
    * Start the pairing/discovery process.
    *
    * @param {Number} timeoutSeconds Number of seconds to run before timeout
    */
    startPairing(_timeoutSeconds: number) {
        this.deviceDiscovery = DeviceDiscovery({
            timeout: _timeoutSeconds * 1000
        }, (device) => {
            this.addDevice(device).catch(console.warn);
        });
    }

    /**
    * Cancel the pairing/discovery process.
    */
    cancelPairing() {
        this.deviceDiscovery?.destroy();
    }

    /**
    * Unpair the provided the device from the adapter.
    *
    * @param {Object} device Device to unpair with
    */
    removeThing(device: any) {
        try {
            this.removeDevice(device.id);
            console.log('SonosAdapter: device:', device.id, 'was unpaired.');
        }
        catch (err) {
            console.error('SonosAdapter: unpairing', device.id, 'failed');
            console.error(err);
        }
    }

    /**
    * Cancel unpairing process.
    *
    * @param {Object} device Device that is currently being paired
    */
    cancelRemoveThing(_device: any) {
    }
}
