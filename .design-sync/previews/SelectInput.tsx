import React, { useState } from "react";
import { SelectInput } from "@garzoni/web";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div
    data-theme="dark"
    style={{ background: "#0b0f14", padding: 28, maxWidth: 380 }}
  >
    {children}
  </div>
);

const trades = [
  { value: "goldsmith", label: "Goldsmith" },
  { value: "painter", label: "Painter" },
  { value: "weaver", label: "Weaver" },
  { value: "carpenter", label: "Carpenter" },
];

export const Default = () => {
  const [value, setValue] = useState("painter");
  return (
    <Stage>
      <SelectInput
        id="trade"
        label="Trade"
        value={value}
        onChange={setValue}
        options={trades}
      />
    </Stage>
  );
};

export const WithHelper = () => {
  const [value, setValue] = useState("goldsmith");
  return (
    <Stage>
      <SelectInput
        id="trade2"
        label="Trade"
        value={value}
        onChange={setValue}
        options={trades}
        helperText="The craft recorded in the apprenticeship contract."
      />
    </Stage>
  );
};

export const WithError = () => {
  const [value, setValue] = useState("");
  return (
    <Stage>
      <SelectInput
        id="trade3"
        label="Trade"
        value={value}
        onChange={setValue}
        options={[{ value: "", label: "Select a trade…" }, ...trades]}
        error="A trade is required."
      />
    </Stage>
  );
};
