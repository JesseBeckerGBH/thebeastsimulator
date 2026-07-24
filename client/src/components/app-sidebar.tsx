import { LayoutGrid, SlidersHorizontal, FileBarChart, Activity } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const items = [
  { title: "Overview", url: "/", icon: LayoutGrid },
  { title: "Model Roster", url: "/roster", icon: SlidersHorizontal },
  { title: "Backtest Results", url: "/backtest", icon: Activity },
  { title: "Performance Report", url: "/report", icon: FileBarChart },
];

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-label="The Beast Simulator logo">
      <circle cx="9" cy="9" r="3" fill="currentColor" />
      <circle cx="23" cy="9" r="3" fill="currentColor" fillOpacity="0.45" />
      <circle cx="9" cy="23" r="3" fill="currentColor" fillOpacity="0.45" />
      <circle cx="23" cy="23" r="3" fill="currentColor" fillOpacity="0.45" />
      <circle cx="16" cy="16" r="4" fill="currentColor" />
      <path
        d="M9 9L16 16M23 9L16 16M9 23L16 16M23 23L16 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.6"
      />
    </svg>
  );
}

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2 px-1 text-sidebar-primary">
          <Logo />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold text-sidebar-foreground" data-testid="text-app-name">
              The Beast
            </span>
            <span className="text-xs text-sidebar-foreground/60">Simulator</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 py-3">
        <p className="text-xs text-sidebar-foreground/50 leading-relaxed">
          Synthetic backtests for research purposes. Not betting advice.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
