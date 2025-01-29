const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", await deployer.getAddress());

  const JobMarketplace = await hre.ethers.getContractFactory("JobMarketplace");
  const jobMarketplace = await JobMarketplace.deploy();

  await jobMarketplace.waitForDeployment();

  const contractAddress = await jobMarketplace.getAddress();
  console.log("JobMarketplace deployed to:", contractAddress);

  const tx = jobMarketplace.deploymentTransaction();
  console.log("Transaction hash:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
