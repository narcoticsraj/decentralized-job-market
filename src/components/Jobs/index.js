import * as ethers from 'ethers';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

// Contract ABI - Replace this with your actual contract ABI
const CONTRACT_ADDRESS = "0xe4fE59D5Afa8Ee66b1eD2F685907BBaAe95bdC3e";
const CONTRACT_ABI = [
  "function createProfile(string memory _name, string memory _skills) external",
  "function postJob(string memory _title, string memory _description, uint256 _budget) external returns (uint256)",
  "function applyForJob(uint256 _jobId, string memory _proposal, uint256 _proposedPrice) external",
  "function getJob(uint256 _jobId) external view returns (tuple(uint256 id, address employer, string title, string description, uint256 budget, bool isActive, address selectedFreelancer, uint8 status))",
  "function getProfile(address _user) external view returns (tuple(string name, string skills, uint256 rating, uint256 totalRatings, bool isRegistered))",
  "function getJobApplications(uint256 _jobId) external view returns (tuple(uint256 jobId, address freelancer, string proposal, uint256 proposedPrice, bool isAccepted)[] memory)",
  "function jobCounter() external view returns (uint256)"
];

const JobMarketplace = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    profileName: '',
    profileSkills: '',
    jobTitle: '',
    jobDescription: '',
    jobBudget: '',
    proposal: '',
    proposedPrice: ''
  });

  // Initialize Web3 and contract
  useEffect(() => {
    const init = async () => {
      try {
        if (window.ethereum) {
          const web3Provider = new ethers.Web3Provider(window.ethereum); // Fixed to Web3Provider
          const web3Signer = web3Provider.getSigner();
          const jobContract = new ethers.Contract(
            CONTRACT_ADDRESS,
            CONTRACT_ABI,
            web3Signer
          );

          setProvider(web3Provider);
          setSigner(web3Signer);
          setContract(jobContract);

          // Handle account changes
          window.ethereum.on('accountsChanged', handleAccountChange);
        } else {
          setError('Please install MetaMask to use this application');
        }
      } catch (err) {
        setError('Error initializing Web3: ' + err.message);
      }
    };

    init();
  }, []);

  const handleAccountChange = async (accounts) => {
    if (accounts.length > 0) {
      setAccount(accounts[0]);
      loadUserProfile(accounts[0]);
      loadJobs();
    } else {
      setAccount('');
      setUserProfile(null);
    }
  };

  // Connect wallet
  const connectWallet = async () => {
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      setAccount(accounts[0]);
      await loadUserProfile(accounts[0]);
      await loadJobs();
    } catch (err) {
      setError('Error connecting wallet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load user profile
  const loadUserProfile = async (address) => {
    try {
      const profile = await contract.getProfile(address);
      if (profile.isRegistered) {
        setUserProfile(profile);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  // Load jobs
  const loadJobs = async () => {
    try {
      setLoading(true);
      const jobCount = await contract.jobCounter(); // Ensure this function exists in your contract
      const jobPromises = [];
      
      for (let i = 0; i < jobCount; i++) {
        jobPromises.push(contract.getJob(i));
      }
      
      const loadedJobs = await Promise.all(jobPromises);
      setJobs(loadedJobs.filter(job => job.isActive));
    } catch (err) {
      setError('Error loading jobs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create profile
  const createProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const tx = await contract.createProfile(
        formData.profileName,
        formData.profileSkills
      );
      await tx.wait();
      await loadUserProfile(account);
      setFormData({ ...formData, profileName: '', profileSkills: '' });
    } catch (err) {
      setError('Error creating profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Post job
  const postJob = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const budget = ethers.parseEther(formData.jobBudget);
      const tx = await contract.postJob(
        formData.jobTitle,
        formData.jobDescription,
        budget
      );
      await tx.wait();
      await loadJobs();
      setFormData({ ...formData, jobTitle: '', jobDescription: '', jobBudget: '' });
    } catch (err) {
      setError('Error posting job: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Apply for job
  const applyForJob = async (jobId) => {
    try {
      setLoading(true);
      const proposedPrice = ethers.parseEther(formData.proposedPrice);
      const tx = await contract.applyForJob(
        jobId,
        formData.proposal,
        proposedPrice
      );
      await tx.wait();
      setFormData({ ...formData, proposal: '', proposedPrice: '' });
    } catch (err) {
      setError('Error applying for job: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center">
          <AlertCircle className="mr-2" />
          {error}
        </div>
      )}

      {!account ? (
        <Card>
          <CardContent className="pt-6">
            <button
              onClick={connectWallet}
              disabled={loading}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Connected Account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono">{account}</p>
            </CardContent>
          </Card>

          {!userProfile ? (
            <Card>
              <CardHeader>
                <CardTitle>Create Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      className="w-full p-2 border rounded"
                      value={formData.profileName}
                      onChange={(e) => setFormData({...formData, profileName: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Skills</label>
                    <input
                      type="text"
                      className="w-full p-2 border rounded"
                      value={formData.profileSkills}
                      onChange={(e) => setFormData({...formData, profileSkills: e.target.value})}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Profile'}
                  </button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Post a Job</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={postJob} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Title</label>
                      <input
                        type="text"
                        className="w-full p-2 border rounded"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        className="w-full p-2 border rounded"
                        value={formData.jobDescription}
                        onChange={(e) => setFormData({...formData, jobDescription: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Budget (ETH)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2 border rounded"
                        value={formData.jobBudget}
                        onChange={(e) => setFormData({...formData, jobBudget: e.target.value})}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {loading ? 'Posting...' : 'Post Job'}
                    </button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Available Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-4">Loading jobs...</div>
                  ) : (
                    <div className="space-y-4">
                      {jobs.map((job) => (
                        <div key={job.id.toString()} className="border p-4 rounded">
                          <h3 className="font-bold">{job.title}</h3>
                          <p className="text-gray-600">{job.description}</p>
                          <p className="text-sm">Budget: {ethers.formatEther(job.budget)} ETH</p>
                          {job.employer !== account && (
                            <div className="mt-2 space-y-2">
                              <input
                                type="text"
                                placeholder="Your proposal"
                                className="w-full p-2 border rounded"
                                onChange={(e) => setFormData({...formData, proposal: e.target.value})}
                              />
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Proposed price (ETH)"
                                className="w-full p-2 border rounded"
                                onChange={(e) => setFormData({...formData, proposedPrice: e.target.value})}
                              />
                              <button
                                onClick={() => applyForJob(job.id)}
                                disabled={loading}
                                className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-50"
                              >
                                {loading ? 'Applying...' : 'Apply'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default JobMarketplace;
