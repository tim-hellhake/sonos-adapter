/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare module 'gateway-addon' {
    class Event {
        constructor(device: any, name: string, data?: any);
    }

    interface EventDescription {
        name: string;
        metadata: EventMetadata;
    }

    interface EventMetadata {
        description: string,
        type: string
    }

    class Property {
        public value: any
        public device: Device;
        public readOnly: boolean;
        constructor(device: Device, name: string, propertyDescr: {});
        public setCachedValue(value: any): void;
        public setCachedValueAndNotify(value: any): void;
        public setValue(value: any): Promise<void>
    }

    class Device {
        protected '@context': string;
        protected '@type': string[];
        protected id: string;
        protected name: string;
        protected description: string;
        protected adapter: Adapter;

        constructor(adapter: Adapter, id: string);

        public properties: Map<String, Property>;
        public notifyPropertyChanged(property: Property): void;
        public addAction(name: string, metadata: any): void;

        public events: Map<String, EventDescription>;
        public eventNotify(event: Event): void;
        public setTitle(name: any): void;
        public findProperty(propertyName: string): Property;
    }

    class Adapter {
        public devices: { [id: string]: Device };

        constructor(addonManager: any, id: string, packageName: string);

        public handleDeviceAdded(device: Device): void;
        public handleDeviceRemoved(device: Device): void;
        public removeThing(device: Device): void;
        public startPairing(_timeoutSeconds: number): void;
    }

    class Database {
        constructor(packageName: string, path?: string);

        public open(): Promise<void>;
        public loadConfig(): Promise<any>;
        public saveConfig(config: any): Promise<void>;
        public close(): void;
    }
}
