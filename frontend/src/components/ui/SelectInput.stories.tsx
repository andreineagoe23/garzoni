import React, { useState } from "react";
import SelectInput from "./SelectInput";

export default {
  title: "UI/SelectInput",
  component: SelectInput,
  parameters: {
    docs: {
      description: {
        story:
          "Accessible select input with label association and helper/error text. Keyboard: Tab to focus, Up/Down to change selection.",
      },
    },
  },
};

export const Default = () => {
  const [value, setValue] = useState("starter");
  return (
    <div className="max-w-sm p-6">
      <SelectInput
        id="plan"
        label="Plan"
        value={value}
        onChange={setValue}
        options={[
          { value: "starter", label: "Starter" },
          { value: "plus", label: "Plus" },
          { value: "pro", label: "Pro" },
        ]}
        helperText="You can change this later."
      />
    </div>
  );
};
