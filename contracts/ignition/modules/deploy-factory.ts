import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BaseERC20Factory", (m) => {
  // Deploy the BaseERC20Factory contract
  const factory = m.contract("BaseERC20Factory");

  return { factory };
}); 