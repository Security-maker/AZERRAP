import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import type { AppUser } from '../../types';

export function AgentMap({ agents }: { agents: AppUser[] }) {
  const located = agents.filter((a) => (a as never as { gps?: { lat: number; lng: number } }).gps);
  const center: [number, number] = located[0] ? [(located[0] as never as { gps: { lat: number; lng: number } }).gps.lat, (located[0] as never as { gps: { lat: number; lng: number } }).gps.lng] : [43.433, 6.737];
  return (
    <div className="h-[380px] overflow-hidden rounded-3xl border border-white/10 bg-obsidian">
      <MapContainer center={center} zoom={11} className="h-full w-full" zoomControl={false}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {located.map((agent) => {
          const gps = (agent as never as { gps: { lat: number; lng: number } }).gps;
          return <Marker key={agent.uid} position={[gps.lat, gps.lng]}><Popup>{agent.prenom} {agent.nom}<br />{agent.statut}</Popup></Marker>;
        })}
      </MapContainer>
    </div>
  );
}
