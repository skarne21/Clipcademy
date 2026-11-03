import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Clipcademy heading", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Clipcademy" })).toBeInTheDocument();
});
