'use strict';

const { Sonos, DeviceDiscovery } = require("sonos");
const Speaker = require("./speaker");

//TODO cache state

let Adapter;
try {
    Adapter = require('../adapter');
}
catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }

    const gwa = require('gateway-addon');
    Adapter = gwa.Adapter;
}

class SonosAdapter extends Adapter {
    constructor(addonManager, packageName) {
        super(addonManager, 'SonosAdapter', packageName);
        addonManager.addAdapter(this);
    }

    /**
    * @param {SonosDevice} device Sonos device to add.
    * @return {Promise} which resolves to the device added.
    */
    addDevice(device) {
        if(device.host in this.devices) {
            return Promise.reject('Device: ' + device.host + ' already exists.');
        }
        else {
            const speaker = new Speaker(this, device.host, device);
            return speaker.ready;
        }
    }

    /**
    * @param {String} deviceId ID of the device to remove.
    * @return {Promise} which resolves to the device removed.
    */
    removeDevice(deviceId) {
        return new Promise((resolve, reject) => {
            const device = this.devices[deviceId];
            if(device) {
                this.handleDeviceRemoved(device);
                resolve(device);
            }
            else {
                reject('Device: ' + deviceId + ' not found.');
            }
        });
    }

    /**
    * Start the pairing/discovery process.
    *
    * @param {Number} timeoutSeconds Number of seconds to run before timeout
    */
    startPairing(_timeoutSeconds) {
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
        this.deviceDiscovery.destroy();
    }

    /**
    * Unpair the provided the device from the adapter.
    *
    * @param {Object} device Device to unpair with
    */
    removeThing(device) {
        this.removeDevice(device.id).then(() => {
            console.log('SonosAdapter: device:', device.id, 'was unpaired.');
        }).catch((err) => {
            console.error('SonosAdapter: unpairing', device.id, 'failed');
            console.error(err);
        });
    }

    /**
    * Cancel unpairing process.
    *
    * @param {Object} device Device that is currently being paired
    */
    cancelRemoveThing(device) {
    }
}

function loadAdapter(addonManager, manifest, _errorCallback) {
  const adapter = new SonosAdapter(addonManager, manifest.name);
}

module.exports = loadAdapter;
