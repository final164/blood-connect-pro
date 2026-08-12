import { useEffect, useState } from "react";
import {
  DEFAULT_DONATION_FLOW_SETTINGS,
  fetchDonationFlowSettings,
  type DonationFlowSettings,
} from "@/lib/donation-flow-settings";
import {
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
  type MessagingSettings,
} from "@/lib/messaging-settings";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  fetchNotificationSettings,
  type NotificationSettings,
} from "@/lib/notification-settings";

export type FeedCardChrome = {
  messaging: MessagingSettings;
  donationFlow: DonationFlowSettings;
  enableManagedButton: boolean;
  ready: boolean;
};

let shared: FeedCardChrome | null = null;
let inflight: Promise<FeedCardChrome> | null = null;
const listeners = new Set<(v: FeedCardChrome) => void>();

async function loadChrome(): Promise<FeedCardChrome> {
  if (shared?.ready) return shared;
  if (inflight) return inflight;
  inflight = Promise.all([
    fetchMessagingSettings(),
    fetchDonationFlowSettings(),
    fetchNotificationSettings(),
  ]).then(([messaging, donationFlow, notif]) => {
    shared = {
      messaging,
      donationFlow,
      enableManagedButton: (notif as NotificationSettings).enable_managed_button !== false,
      ready: true,
    };
    inflight = null;
    for (const l of listeners) l(shared);
    return shared;
  });
  return inflight;
}

/** One shared fetch for all feed cards — avoids N×3 settings requests. */
export function useFeedCardChrome(): FeedCardChrome {
  const [state, setState] = useState<FeedCardChrome>(
    shared ?? {
      messaging: DEFAULT_MESSAGING_SETTINGS,
      donationFlow: DEFAULT_DONATION_FLOW_SETTINGS,
      enableManagedButton: DEFAULT_NOTIFICATION_SETTINGS.enable_managed_button !== false,
      ready: false,
    },
  );

  useEffect(() => {
    let alive = true;
    listeners.add(setState);
    void loadChrome().then((v) => {
      if (alive) setState(v);
    });
    return () => {
      alive = false;
      listeners.delete(setState);
    };
  }, []);

  return state;
}
