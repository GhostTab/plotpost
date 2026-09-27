import { render } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["PENDING", "Pending"],
    ["SUCCESS", "Success"],
    ["UNSUCCESSFUL", "Unsuccessful"],
  ] as const)("maps %s to %s", (status, label) => {
    const { getByTestId } = render(<StatusBadge status={status} />);
    const badge = getByTestId("status-badge");
    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveAttribute("data-status", status);
  });
});
