/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare module 'sonos' {
    function DeviceDiscovery(options: { timeout: number }, cb: (device: any) => void): Discovery;

    class Discovery {
        destroy(): void;
    }

    class Sonos {
        constructor(address: any);
    }

    enum SpotifyRegion {
        EU,
        US
    }
}
