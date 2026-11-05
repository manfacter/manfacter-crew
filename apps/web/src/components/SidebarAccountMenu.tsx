import { Trans, useLingui } from "@lingui/react/macro";
import type { NavLink } from "@rakazo/contracts";
import {
  AppMarkStack,
  Button,
  buttonVariants,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rakazo/ui-web";
import {
  BookOpen,
  Check,
  Download,
  FolderOpen,
  Link2,
  LogOut,
  Plug,
  ScrollText,
  Settings,
  SquareKanban,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Organization } from "../lib/organizations";
import { useSidebarUpdate } from "./DesktopUpdates";
import { IconTooltip } from "./IconTooltip";

type Props = {
  mini?: boolean;
  name: string;
  logos?: Array<{ name: string; logo?: string | null }>;
  email?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIntegrations: () => void;
  onSkills: () => void;
  onBoard?: () => void;
  links?: NavLink[];
  onLink?: (link: NavLink) => void;
  onArtifacts: () => void;
  onSettings: () => void;
  onInvite?: () => void;
  onLogOut: () => void;
  signingOut: boolean;
  logOutError: string | null;
  organizations?: Organization[];
  activeOrganizationId?: string | null;
  onSwitchOrganization?: (organization: Organization) => void;
  children?: ReactNode;
};

export function SidebarAccountMenu({
  mini = false,
  name,
  logos = [],
  email,
  open,
  onOpenChange,
  onIntegrations,
  onSkills,
  onBoard,
  links = [],
  onLink,
  onArtifacts,
  onSettings,
  onInvite,
  onLogOut,
  signingOut,
  logOutError,
  organizations = [],
  activeOrganizationId,
  onSwitchOrganization,
  children,
}: Props) {
  const { t } = useLingui();
  const update = useSidebarUpdate();
  return (
    <div
      data-testid="sidebar-account-menu"
      className={`app-no-drag flex shrink-0 items-center gap-1 ${mini ? "flex-col" : ""}`}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <IconTooltip label={t`Settings`}>
          <PopoverTrigger
            render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" />}
            data-testid="user-menu-trigger"
            aria-label={t`Account menu for ${name}`}
          >
            <Settings size={15} strokeWidth={1.8} aria-hidden="true" />
          </PopoverTrigger>
        </IconTooltip>
        {open ? (
          <PopoverContent
            side="bottom"
            sideOffset={8}
            align="end"
            className="max-h-(--available-height) w-[295px] max-w-[calc(100vw-69px)] gap-0 overflow-y-auto p-1 *:shrink-0 data-closed:animate-none"
          >
            <div
              data-testid="account-menu-header"
              className="mb-1 min-w-0 border-b border-border px-2.5 py-2.5"
            >
              <p className="truncate text-sm font-medium">{name}</p>
              {email && email !== name ? (
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              ) : null}
            </div>
            {children}
            {organizations.length > 1 ? (
              <>
                {organizations.map((organization) => {
                  const active = organization.id === activeOrganizationId;
                  return (
                    <Button
                      key={organization.id}
                      variant="ghost"
                      aria-current={active ? "true" : undefined}
                      className="h-9 w-full justify-between gap-2.5 font-normal"
                      onClick={() => onSwitchOrganization?.(organization)}
                    >
                      <span className="min-w-0 truncate">{organization.name}</span>
                      {active ? <Check aria-hidden="true" strokeWidth={1.75} /> : null}
                    </Button>
                  );
                })}
                <div className="my-1 border-t border-border" />
              </>
            ) : null}
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              onClick={onIntegrations}
            >
              <Plug className="text-muted-foreground" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate text-left">
                <Trans>Connect apps</Trans>
              </span>
              <AppMarkStack marks={logos.slice(0, 3)} ringClassName="ring-popover" />
            </Button>
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              aria-label={t`Settings`}
              onClick={onSettings}
            >
              <Settings className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Settings</Trans>
            </Button>
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              onClick={onSkills}
            >
              <ScrollText className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Skills</Trans>
            </Button>
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              onClick={onArtifacts}
            >
              <FolderOpen className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Artifacts</Trans>
            </Button>
            {onBoard ? (
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={onBoard}
              >
                <SquareKanban className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Board</Trans>
              </Button>
            ) : null}
            {links.map((link) => (
              <Button
                key={link.id}
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={() => onLink?.(link)}
              >
                <Link2 className="text-muted-foreground" strokeWidth={1.75} />
                {link.label}
              </Button>
            ))}
            <div className="my-1 border-t border-border" />
            {onInvite ? (
              <Button
                variant="ghost"
                className="h-9 w-full justify-start gap-2.5 font-normal"
                onClick={onInvite}
              >
                <UserPlus className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Invite friends</Trans>
              </Button>
            ) : null}
            <a
              className={`${buttonVariants({ variant: "ghost" })} h-9 w-full justify-start gap-2.5 font-normal`}
              href="https://github.com/manfacter/manfacter-crew/blob/codex/admin-embed/docs/admin-embed.md"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Docs</Trans>
            </a>
            <div className="my-1 border-t border-border" />
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 font-normal"
              disabled={signingOut}
              onClick={onLogOut}
            >
              <LogOut className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Log out</Trans>
            </Button>
            {logOutError ? (
              <p role="alert" className="px-2.5 pt-1 pb-2 text-[13px] text-destructive">
                {logOutError}
              </p>
            ) : null}
          </PopoverContent>
        ) : null}
      </Popover>
      {update.available ? (
        <IconTooltip label={t`Install update`}>
          <Button
            size="icon-lg"
            className="rounded-full"
            aria-label={t`Install update`}
            disabled={update.busy}
            onClick={update.install}
          >
            <Download aria-hidden="true" />
          </Button>
        </IconTooltip>
      ) : null}
    </div>
  );
}
