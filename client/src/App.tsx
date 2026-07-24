import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, ThemeToggle } from "@/components/theme-toggle";
import { EnsembleProvider } from "@/lib/ensemble-context";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/overview";
import Roster from "@/pages/roster";
import Backtest from "@/pages/backtest";
import Report from "@/pages/report";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/roster" component={Roster} />
      <Route path="/backtest" component={Backtest} />
      <Route path="/report" component={Report} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <EnsembleProvider>
          <TooltipProvider>
            <Router hook={useHashLocation}>
              <SidebarProvider style={style as React.CSSProperties}>
                <div className="flex h-screen w-full overflow-hidden bg-background">
                  <AppSidebar />
                  <div className="flex flex-1 flex-col min-w-0">
                    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
                      <SidebarTrigger data-testid="button-sidebar-toggle" />
                      <ThemeToggle />
                    </header>
                    <main className="flex-1 overflow-y-auto overscroll-contain">
                      <AppRouter />
                    </main>
                  </div>
                </div>
              </SidebarProvider>
            </Router>
            <Toaster />
          </TooltipProvider>
        </EnsembleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
