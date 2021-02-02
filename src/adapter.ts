/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

import { Adapter, Database } from 'gateway-addon';
import { DeviceDiscovery, Sonos, Discovery } from 'sonos';
import { Speaker } from './speaker';
const manifest = require('../manifest.json');

//TODO cache state

export class SonosAdapter extends Adapter {
    private deviceDiscovery?: Discovery;

    constructor(addonManager: any) {
        super(addonManager, 'SonosAdapter', manifest.id);
        addonManager.addAdapter(this);
        this.init();
    }

    private async readConfig() {
        const db = new Database(manifest.id);
        await db.open();
        const config = { ...manifest.options.default, ...await db.loadConfig() };
        db.saveConfig(config);
        db.close();
        return config;
    }

    private async init() {
        const config = await this.readConfig();

        if (config && config.addresses) {
            for (const addr of config.addresses) {
                const device = new Sonos(addr);
                try {
                    await this.addDevice(device, config);
                } catch (e) {
                    console.warn(e);
                }
            }
        }

        this.discover(20000, config);
    }

    private discover(timeout: number, config: any) {
        return DeviceDiscovery({
            timeout
        }, async (device: any) => {
            try {
                await this.addDevice(device, config);
            } catch (e) {
                console.warn(e);
            }
        });
    }

    /**
    * @param {SonosDevice} device Sonos device to add.
    * @return {Promise} which resolves to the device added.
    */
    async addDevice(device: any, config: any) {
        const deviceDescription = await device.deviceDescription();
        if (deviceDescription.serialNum in this.devices) {
            throw 'Device: ' + deviceDescription.serialNum + ' already exists.';
        }
        else {
            // Don't try to add BRIDGEs
            //TODO should also avoid adding BOOSTs
            if (deviceDescription.zoneType != '4') {
                const speaker = new Speaker(this, deviceDescription.serialNum, device, config);
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
    async startPairing(_timeoutSeconds: number) {
        const config = await this.readConfig();
        this.deviceDiscovery = this.discover(_timeoutSeconds * 1000, config);
    }

    /**
    * Cancel the pairing/discovery process.
    */
    cancelPairing() {
        try {
            this.deviceDiscovery?.destroy();
        } catch (e) {
            console.log(`Error on stopping device discovery: ${e}`)
        }
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
}
