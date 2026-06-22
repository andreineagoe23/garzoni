import React, { useState } from "react";
import { TextInput } from "@garzoni/web";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div data-theme="dark" style={{ background: "#0b0f14", padding: 28, maxWidth: 380 }}>
    {children}
  </div>
);

export const Default = () => {
  const [value, setValue] = useState("Giovanni di Maestro");
  return (
    <Stage>
      <TextInput id="name" label="Full name" value={value} onChange={setValue} />
    </Stage>
  );
};

export const WithHelper = () => {
  const [value, setValue] = useState("");
  return (
    <Stage>
      <TextInput
        id="workshop"
        label="Workshop"
        value={value}
        onChange={setValue}
        placeholder="e.g. goldsmith"
        helperText="The trade the apprentice was bound to."
      />
    </Stage>
  );
};

export const WithError = () => {
  const [value, setValue] = useState("1567");
  return (
    <Stage>
      <TextInput
        id="year"
        label="Contract year"
        value={value}
        onChange={setValue}
        error="Year must be between 1400 and 1600."
      />
    </Stage>
  );
};

export const Password = () => {
  const [value, setValue] = useState("secret-pass");
  return (
    <Stage>
      <TextInput id="pw" label="Password" type="password" value={value} onChange={setValue} />
    </Stage>
  );
};
