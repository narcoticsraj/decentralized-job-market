const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("JobMarketplace", function () {
  let JobMarketplace;
  let jobMarketplace;
  let owner;
  let employer;
  let freelancer1;
  let freelancer2;
  let addresses;

  const PLATFORM_FEE = 2; // 2%

  beforeEach(async function () {
    // Get signers for different roles
    [owner, employer, freelancer1, freelancer2, ...addresses] = await ethers.getSigners();

    // Deploy the contract
    JobMarketplace = await ethers.getContractFactory("JobMarketplace");
    jobMarketplace = await JobMarketplace.deploy();
    await jobMarketplace.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await jobMarketplace.owner()).to.equal(owner.address);
    });

    it("Should set the correct platform fee", async function () {
      expect(await jobMarketplace.platformFee()).to.equal(PLATFORM_FEE);
    });
  });

  describe("Profile Management", function () {
    it("Should create a profile correctly", async function () {
      await jobMarketplace.connect(freelancer1).createProfile("Alice", "Web3 Developer");
      
      const profile = await jobMarketplace.getProfile(freelancer1.address);
      expect(profile.name).to.equal("Alice");
      expect(profile.skills).to.equal("Web3 Developer");
      expect(profile.isRegistered).to.equal(true);
    });

    it("Should prevent duplicate profile creation", async function () {
      await jobMarketplace.connect(freelancer1).createProfile("Alice", "Web3 Developer");
      
      await expect(
        jobMarketplace.connect(freelancer1).createProfile("Alice2", "Updated Skills")
      ).to.be.revertedWith("Profile already exists");
    });
  });

  describe("Job Posting", function () {
    beforeEach(async function () {
      await jobMarketplace.connect(employer).createProfile("TechCorp", "Hiring Manager");
    });

    it("Should create a job posting correctly", async function () {
      const jobTitle = "Smart Contract Developer";
      const jobDescription = "Develop DeFi protocol";
      const budget = ethers.utils.parseEther("1.0");

      await expect(
        jobMarketplace.connect(employer).postJob(jobTitle, jobDescription, budget)
      )
        .to.emit(jobMarketplace, "JobCreated")
        .withArgs(0, employer.address, jobTitle, budget);

      const job = await jobMarketplace.getJob(0);
      expect(job.title).to.equal(jobTitle);
      expect(job.budget).to.equal(budget);
      expect(job.status).to.equal(0); // JobStatus.Open
    });

    it("Should prevent job posting without profile", async function () {
      await expect(
        jobMarketplace.connect(addresses[0]).postJob("Title", "Description", 1000)
      ).to.be.revertedWith("Profile not registered");
    });
  });

  describe("Job Applications", function () {
    const jobId = 0;
    const budget = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
      await jobMarketplace.connect(employer).createProfile("TechCorp", "Hiring Manager");
      await jobMarketplace.connect(freelancer1).createProfile("Alice", "Developer");
      await jobMarketplace.connect(employer).postJob("Developer", "Description", budget);
    });

    it("Should submit application correctly", async function () {
      await expect(
        jobMarketplace.connect(freelancer1).applyForJob(
          jobId,
          "I'm interested",
          ethers.utils.parseEther("0.9")
        )
      )
        .to.emit(jobMarketplace, "ApplicationSubmitted")
        .withArgs(jobId, freelancer1.address);

      const applications = await jobMarketplace.getJobApplications(jobId);
      expect(applications.length).to.equal(1);
      expect(applications[0].freelancer).to.equal(freelancer1.address);
    });
  });

  describe("Job Completion and Payment", function () {
    const jobId = 0;
    const budget = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
      await jobMarketplace.connect(employer).createProfile("TechCorp", "Hiring Manager");
      await jobMarketplace.connect(freelancer1).createProfile("Alice", "Developer");
      await jobMarketplace.connect(employer).postJob("Developer", "Description", budget);
      await jobMarketplace.connect(freelancer1).applyForJob(jobId, "Interested", budget);
      await jobMarketplace.connect(employer).selectFreelancer(jobId, freelancer1.address);
    });

    it("Should process payment correctly", async function () {
      const platformFeeAmount = budget.mul(PLATFORM_FEE).div(100);
      const freelancerPayment = budget.sub(platformFeeAmount);

      await expect(
        jobMarketplace.connect(employer).completeJob(jobId, { value: budget })
      )
        .to.emit(jobMarketplace, "JobCompleted")
        .withArgs(jobId, freelancer1.address, freelancerPayment)
        .to.changeEtherBalance(freelancer1, freelancerPayment);

      const job = await jobMarketplace.getJob(jobId);
      expect(job.status).to.equal(2); // JobStatus.Completed
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update platform fee", async function () {
      const newFee = 5;
      await jobMarketplace.connect(owner).updatePlatformFee(newFee);
      expect(await jobMarketplace.platformFee()).to.equal(newFee);
    });

    it("Should prevent non-owner from updating platform fee", async function () {
      await expect(
        jobMarketplace.connect(freelancer1).updatePlatformFee(5)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to pause and unpause", async function () {
      await jobMarketplace.connect(owner).pause();
      await expect(
        jobMarketplace.connect(freelancer1).createProfile("Alice", "Developer")
      ).to.be.revertedWith("Pausable: paused");

      await jobMarketplace.connect(owner).unpause();
      await expect(
        jobMarketplace.connect(freelancer1).createProfile("Alice", "Developer")
      ).to.not.be.reverted;
    });
  });
});