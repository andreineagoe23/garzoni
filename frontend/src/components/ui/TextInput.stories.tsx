import React, { useState } from "react";
import TextInput from "./TextInput";

export default {
  title: "UI/TextInput",
  component: TextInput,
  parameters: {
    docs: {
      description: {
        story:
          "Accessible text input with label association and helper/error text. Keyboard: Tab to focus, Enter to submit parent form.",
      },
    },
  },
};

export const Default = () => {
  const [value, setValue] = useState("");
  return (
    <div className="max-w-sm p-6">
      <TextInput
        id="name"
        label="Full name"
        value={value}
        onChange={setValue}
        placeholder="Enter your name"
        helperText="Used for certificates."
      />
    </div>
  );
};
