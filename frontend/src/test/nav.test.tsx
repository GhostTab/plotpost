import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { AppShell } from "@/components/Layout";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    profile: { username: "alice", id: "1" },
    user: { user_metadata: { username: "alice" } },
    signOut: vi.fn(),
    loading: false,
    session: {},
    signIn: vi.fn(),
    signUp: vi.fn(),
  }),
}));

function renderNav() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppShell navigation", () => {
  it("shows primary nav and profile dropdown items", async () => {
    const user = userEvent.setup();
    renderNav();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Search" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recommendations" })).toHaveAttribute(
      "href",
      "/recommendations",
    );

    await user.click(screen.getByRole("button", { name: /alice/i }));
    expect(await screen.findByRole("menuitem", { name: "My profile" })).toHaveAttribute(
      "href",
      "/users/alice",
    );
    expect(screen.getByRole("menuitem", { name: /Notifications/i })).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });
});
