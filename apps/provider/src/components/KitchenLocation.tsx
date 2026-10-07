'use client';

import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { describeError, formatDateLong, todayIST } from '@bhojan/shared';
import { readBrowserLocation } from '@/lib/location';
import { useAppSettings, useKitchenLocation, useSaveKitchenLocation, type Kitchen } from '@/lib/queries';
import { Button, Card, Loading, Notice, SectionTitle } from './ui';

/** A reading rougher than this is worth redoing from a phone inside the kitchen. */
const GOOD_ENOUGH_METRES = 150;

/**
 * One tap, while standing in the kitchen, tells Bhojan where it is. Customers
 * within the delivery radius can then find it; they are only ever shown roughly
 * how far away it is.
 */
export function KitchenLocation({ kitchen }: { kitchen: Kitchen }) {
  const location = useKitchenLocation(kitchen.id);
  const save = useSaveKitchenLocation();
  const settings = useAppSettings();
  const [finding, setFinding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const radius = settings.data?.delivery_radius_km ?? 10;
  const current = location.data;

  const useMyLocation = async () => {
    setProblem(null);
    setJustSaved(false);
    setFinding(true);
    const reading = await readBrowserLocation();
    setFinding(false);
    if (!reading.ok) {
      setProblem(reading.problem);
      return;
    }
    save.mutate(
      {
        provider_id: kitchen.id,
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracy_m: Math.round(reading.accuracy),
      },
      { onSuccess: () => setJustSaved(true) },
    );
  };

  return (
    <section id="location" className="scroll-mt-6">
      <Card tone={current || location.isPending ? 'default' : 'accent'}>
        <SectionTitle>Kitchen location</SectionTitle>
        <p className="text-ink-soft">
          {`Customers within ${radius} km of your kitchen can find you and order. They are never shown where your kitchen is, only roughly how far away it is.`}
        </p>
        {location.isPending ? (
          <Loading message="Checking your kitchen’s location…" />
        ) : location.error ? (
          <Notice tone="danger">{describeError(location.error, 'loading your kitchen’s location').message}</Notice>
        ) : current ? (
          <Notice tone="success">
            {`${justSaved ? 'Saved. ' : ''}Location set on ${formatDateLong(todayIST(new Date(current.updated_at)))}.`}
          </Notice>
        ) : (
          <Notice tone="highlight">
            No location yet. Customers can’t find your kitchen, and you can’t go live, until you set it.
          </Notice>
        )}
        {current?.accuracy_m != null && current.accuracy_m > GOOD_ENOUGH_METRES ? (
          <Notice tone="highlight">
            {`This reading is only accurate to about ${current.accuracy_m.toLocaleString('en-IN')} metres, which is common on a computer. For a better one, open this page on your phone while you are in your kitchen and tap the button again.`}
          </Notice>
        ) : null}
        {problem ? <Notice tone="danger">{problem}</Notice> : null}
        {save.error ? (
          <Notice tone="danger">{describeError(save.error, 'saving your kitchen’s location').message}</Notice>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            size="lg"
            icon={MapPin}
            loading={finding || save.isPending}
            loadingLabel={finding ? 'Finding where you are…' : 'Saving…'}
            onClick={useMyLocation}
          >
            {current ? 'Update to where I am now' : 'Use my current location'}
          </Button>
          {current ? (
            <a
              className="font-bold text-primary underline underline-offset-4"
              href={`https://www.openstreetmap.org/?mlat=${current.latitude}&mlon=${current.longitude}#map=17/${current.latitude}/${current.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Check it on a map (opens OpenStreetMap)
            </a>
          ) : null}
        </div>
        <p className="text-small text-ink-soft">
          Do this while you are in your kitchen. Your browser will ask for permission: choose Allow.
        </p>
      </Card>
    </section>
  );
}
