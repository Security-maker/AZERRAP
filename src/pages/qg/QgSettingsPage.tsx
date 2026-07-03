import { Card, PageHeader } from '../../components/ui/Card';

export default function QgSettingsPage() {
  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration générale de l’agence, RGPD, WhatsApp QG et politique de conservation." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="text-xl font-extrabold">RGPD</h2><p className="mt-3 text-sm leading-6 text-metal">La géolocalisation est liée à la mission et seulement active pendant le service. Aucun suivi GPS hors poste. Les accès sensibles sont journalisés.</p></Card>
        <Card><h2 className="text-xl font-extrabold">WhatsApp QG</h2><p className="mt-3 text-sm leading-6 text-metal">Le numéro QG peut être global ou spécifique à un site. Canal non critique : l’urgence passe par SOS/PTI.</p></Card>
        <Card><h2 className="text-xl font-extrabold">Données</h2><p className="mt-3 text-sm leading-6 text-metal">Prévoir une durée de conservation par type : rapports, rondes, alertes, logs d’audit et documents site.</p></Card>
        <Card><h2 className="text-xl font-extrabold">Notifications</h2><p className="mt-3 text-sm leading-6 text-metal">Firebase Cloud Messaging peut être ajouté pour les notifications push, avec contraintes iOS/Android à valider.</p></Card>
      </div>
    </div>
  );
}
