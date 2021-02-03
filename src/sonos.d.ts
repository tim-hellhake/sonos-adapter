/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare module 'sonos' {
    function DeviceDiscovery(options: { timeout: number }, cb: (device: Sonos) => void): Discovery;

    class Discovery {
      destroy(): void;
    }

    class Sonos {
      public host: string;

      constructor(address: any);

      getVolume(): number;
      getMuted(): boolean;
      getCurrentState(): State;
      currentTrack(): Track;
      getPlayMode(): string;
      getAllGroups(): Group[];
      getZoneInfo(): ZoneInfo;
      renderingControlService(): RenderingControlService;
      avTransportService(): AVTransportService;
      play(uri?: string): void;
      pause(): void;
      setVolume(newValue: any): void;
      setPlayMode(arg0: string): void;
      seek(newPosition: number): void;
      setMuted(newValue: any): void;
      next() : void;
      previous(): void;
      stop(): void;
      joinGroup(name: string): void;
      leaveGroup(): void;
      setSpotifyRegion(region: string | SpotifyRegion): void;
      getName(): string

      deviceDescription() : DeviceDescription
      on(arg0: string, arg1: (arg: unknown) => void): void;
      on(name: 'CurrentTrack', cb: (arg: CurrentTrack) => void): void;
      on(name: 'AVTransport', cb: (arg: AVTransport) => void): void;
      on(name: 'Muted', cb: (arg: boolean) => void): void;
      on(name: 'Volume', cb: (arg: number) => void): void;
    }

    interface Track {
        duration: number;
        title: string;
        artist: string;
        album: string;
        position: number;
        albumArtURL: string;
    }

    interface State {
    }

    interface ZoneInfo {
        MACAddress: any;
    }

    interface Group {
        ID: any;
        ZoneGroupMember: ZoneGroupMember[];
        Coordinator: string;
    }

    interface ZoneGroupMember {
        UUID: string;
        ZoneName: string;
        Location: string;
        Invisible: string;
    }

    interface DeviceDescription {
        serialNum: string,
        zoneType: string
    }

    interface CurrentTrack {
      title: string;
      artist: string;
      album: string;
      albumArtURI: string;
      duration: number;
      position: number;
    }
    
    interface AVTransport {
      CurrentPlayMode: string;
      CurrentCrossfadeMode: string;
      CurrentTrackMetaDataParsed: string;
    }

    interface RenderingControlService {
      _request(arg0: string, arg1: { InstanceID: number; }): RenderingResponse;
    }

    interface RenderingResponse {
      CurrentSupportsFixed: string;
      CurrentFixed: string;
    }

    interface AVTransportService {
      SetCrossfadeMode(arg0: { InstanceID: number; CrossfadeMode: any; }): void;
      GetCrossfadeMode(): CrossFade;
    }

    interface CrossFade {
      CurrrentCrossfadeMode: string;
    }

    enum SpotifyRegion {
        EU,
        US
    }
}
