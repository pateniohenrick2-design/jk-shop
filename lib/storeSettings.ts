import { CONTACT_LABEL, CONTACT_URL, REPLY_TIME } from '@/lib/siteConfig';

// Shop-wide settings (Admin → Store Settings). Safe to import from client components.
export type StoreSettingsData = {
  isOpen: boolean;
  closedMessage: string;
  contactUrl: string;
  contactLabel: string;
  replyTime: string;
};

// Used until the admin saves settings for the first time (and while the page loads)
export const DEFAULT_STORE_SETTINGS: StoreSettingsData = {
  isOpen: true,
  closedMessage: "You can still place your order — we'll process it as soon as we're back.",
  contactUrl: CONTACT_URL,
  contactLabel: CONTACT_LABEL,
  replyTime: REPLY_TIME,
};

type Row = {
  isOpen: boolean;
  closedMessage: string | null;
  contactUrl: string | null;
  contactLabel: string | null;
  replyTime: string | null;
} | null;

// DB row → settings with defaults filled in for anything left empty
export function withDefaults(row: Row): StoreSettingsData {
  const d = DEFAULT_STORE_SETTINGS;
  if (!row) return d;
  return {
    isOpen: row.isOpen,
    closedMessage: row.closedMessage?.trim() || d.closedMessage,
    contactUrl: row.contactUrl?.trim() || d.contactUrl,
    contactLabel: row.contactLabel?.trim() || d.contactLabel,
    replyTime: row.replyTime?.trim() || d.replyTime,
  };
}
