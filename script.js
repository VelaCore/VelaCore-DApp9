// ==========================================
// CONFIGURATION & ABIs
// ==========================================

// Bhai, yahan apne addresses check kar lena.
// Usually Token Address aur Staking Address alag hote hain.
const CONFIG = {
    CHAIN_ID: 11155111, // Sepolia Testnet
    CHAIN_ID_HEX: "0xaa36a7",
    RPC_URL: "https://rpc.sepolia.org",
    // Replace these with your ACTUAL different addresses if they are different
    VEC_TOKEN_ADDRESS: "0x82829a882AB09864c5f2D1DA7F3F6650bFE2ebb8", 
    STAKING_CONTRACT_ADDRESS: "0x82829a882AB09864c5f2D1DA7F3F6650bFE2ebb8" 
};

// STANDARD ERC20 ABI (For Token Balance & Approve)
const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

// STANDARD STAKING ABI (Generic Names - Change these if your contract uses different names like 'deposit' instead of 'stake')
const STAKING_ABI = [
    // Read Functions
    "function balanceOf(address account) view returns (uint256)", // Staked balance
    "function earned(address account) view returns (uint256)",    // Pending rewards
    // Write Functions
    "function stake(uint256 amount)",  // Sometimes called: deposit
    "function withdraw(uint256 amount)", 
    "function getReward()",            // Sometimes called: claim
    "function exit()"
];

// ==========================================
// STATE MANAGEMENT
// ==========================================
let provider;       // Web3 Provider
let signer;         // User's wallet signer
let userAddress;    // User's 0x address
let vecContract;    // Token Contract Object
let stakingContract;// Staking Contract Object

// Data state
let balances = {
    eth: "0.00",
    vec: "0.00",
    staked: "0.00",
    rewards: "0.00"
};

// ==========================================
// INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    initParticles();
    
    // Check if wallet is already connected
    if(window.ethereum && window.ethereum.selectedAddress) {
        connectWallet();
    }
});

function initParticles() {
    if(typeof tsParticles !== "undefined"){
        tsParticles.load("tsparticles", {
            fpsLimit: 60,
            particles: {
                color: { value: "#38bdf8" },
                links: { enable: true, color: "#38bdf8", opacity: 0.1, distance: 150 },
                move: { enable: true, speed: 1 },
                number: { value: 40 },
                opacity: { value: 0.3 },
                size: { value: { min: 1, max: 3 } }
            }
        });
    }
}

// ==========================================
// WALLET CONNECTION LOGIC
// ==========================================

async function connectWallet() {
    const btn = document.getElementById('connectWalletBtn');
    
    if(!window.ethereum) {
        showToast("MetaMask not found! Please install it.", "error");
        return;
    }

    try {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Connecting...`;
        
        // 1. Initialize Provider
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // 2. Request Account Access
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        // 3. Check Network
        const network = await provider.getNetwork();
        if(network.chainId !== CONFIG.CHAIN_ID) {
            await switchNetwork();
        }

        // 4. Initialize Contracts
        vecContract = new ethers.Contract(CONFIG.VEC_TOKEN_ADDRESS, ERC20_ABI, signer);
        stakingContract = new ethers.Contract(CONFIG.STAKING_CONTRACT_ADDRESS, STAKING_ABI, signer);

        // 5. Update UI
        updateUIState(true);
        showToast("Wallet Connected Successfully!", "success");

        // 6. Fetch Data
        refreshData();

        // 7. Setup Listeners
        window.ethereum.on('accountsChanged', (accounts) => {
            if(accounts.length === 0) disconnectWallet();
            else window.location.reload();
        });
        window.ethereum.on('chainChanged', () => window.location.reload());

    } catch (error) {
        console.error(error);
        showToast("Connection Failed", "error");
        btn.innerHTML = `<i class="fas fa-wallet"></i> Connect Wallet`;
    }
}

function disconnectWallet() {
    userAddress = null;
    signer = null;
    updateUIState(false);
}

// Force Network Switch to Sepolia
async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.CHAIN_ID_HEX }],
        });
    } catch (switchError) {
        // This error code means the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: CONFIG.CHAIN_ID_HEX,
                        chainName: 'Sepolia Testnet',
                        nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: [CONFIG.RPC_URL],
                        blockExplorerUrls: ['https://sepolia.etherscan.io']
                    }],
                });
            } catch (addError) {
                showToast("Could not add network", "error");
            }
        } else {
            showToast("Please switch to Sepolia Network", "error");
        }
    }
}

// ==========================================
// BLOCKCHAIN DATA FETCHING
// ==========================================

async function refreshData() {
    if(!userAddress) return;

    try {
        // 1. Get ETH Balance
        const ethBal = await provider.getBalance(userAddress);
        balances.eth = ethers.utils.formatEther(ethBal);

        // 2. Get Token Balance (VEC)
        // If contract address is invalid, this will fail, so we try/catch
        try {
            const vecBal = await vecContract.balanceOf(userAddress);
            balances.vec = ethers.utils.formatEther(vecBal);
        } catch(e) { console.warn("Could not read Token balance", e); }

        // 3. Get Staked Balance & Earned
        try {
            const stakedBal = await stakingContract.balanceOf(userAddress);
            balances.staked = ethers.utils.formatEther(stakedBal);

            const earnedVal = await stakingContract.earned(userAddress);
            balances.rewards = ethers.utils.formatEther(earnedVal);
        } catch(e) { console.warn("Could not read Staking data", e); }

        updateDisplayValues();

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// ==========================================
// UI UPDATES
// ==========================================

function updateUIState(isConnected) {
    const btn = document.getElementById('connectWalletBtn');
    const btnText = document.getElementById('walletBtnText');
    const swapBtn = document.getElementById('btnSwap');

    if(isConnected) {
        btn.classList.add('connected');
        btnText.innerText = userAddress.substring(0, 6) + "..." + userAddress.substring(38);
        btn.onclick = null; // Optional: Add disconnect logic here
        if(swapBtn) swapBtn.innerText = "Swap";
    } else {
        btn.classList.remove('connected');
        btnText.innerText = "Connect Wallet";
        btn.onclick = connectWallet;
        if(swapBtn) swapBtn.innerText = "Connect Wallet";
        
        // Reset specific values
        document.getElementById('dash-vec-bal').innerText = "0.00 VEC";
        document.getElementById('dash-staked-bal').innerText = "0.00 VEC";
        document.getElementById('dash-rewards-bal').innerText = "0.00 VEC";
    }
}

function updateDisplayValues() {
    // Helper to format large decimals
    const format = (val) => parseFloat(val).toFixed(2);

    // Dashboard
    document.getElementById('dash-vec-bal').innerText = format(balances.vec) + " VEC";
    document.getElementById('dash-staked-bal').innerText = format(balances.staked) + " VEC";
    document.getElementById('dash-rewards-bal').innerText = format(balances.rewards) + " VEC";

    // Swap
    document.getElementById('swap-bal-in').innerText = format(balances.vec);
    document.getElementById('swap-bal-out').innerText = format(balances.eth);

    // Staking
    document.getElementById('stake-wallet-bal').innerText = format(balances.vec);
    document.getElementById('unstake-staked-bal').innerText = format(balances.staked);
    document.getElementById('reward-earned').innerText = parseFloat(balances.rewards).toFixed(4);
}

// ==========================================
// CONTRACT INTERACTIONS
// ==========================================

// --- STAKE FUNCTION ---
async function handleStake() {
    if(!userAddress) return showToast("Connect Wallet First", "error");
    
    const amountStr = document.getElementById('stakeAmount').value;
    if(!amountStr || parseFloat(amountStr) <= 0) return showToast("Enter a valid amount", "error");

    const btn = document.getElementById('btnStakeAction');
    const originalText = btn.innerText;

    try {
        btn.disabled = true;
        const amountWei = ethers.utils.parseEther(amountStr);

        // 1. Check Allowance
        btn.innerText = "Checking Allowance...";
        const allowance = await vecContract.allowance(userAddress, CONFIG.STAKING_CONTRACT_ADDRESS);

        if (allowance.lt(amountWei)) {
            // 2. Approve
            btn.innerText = "Approving...";
            const approveTx = await vecContract.approve(CONFIG.STAKING_CONTRACT_ADDRESS, amountWei);
            showToast("Approval Transaction Sent...", "info");
            await approveTx.wait();
            showToast("Approval Confirmed!", "success");
        }

        // 3. Stake
        btn.innerText = "Staking...";
        // Note: Check if your contract uses 'stake' or 'deposit'
        const stakeTx = await stakingContract.stake(amountWei);
        showToast("Staking Transaction Sent...", "info");
        await stakeTx.wait();
        
        showToast("Staked Successfully!", "success");
        document.getElementById('stakeAmount').value = "";
        refreshData();

    } catch (error) {
        console.error(error);
        if(error.code === 4001) showToast("Transaction Rejected", "error");
        else showToast("Transaction Failed. Check Console.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// --- UNSTAKE FUNCTION ---
async function handleUnstake() {
    if(!userAddress) return showToast("Connect Wallet First", "error");

    const amountStr = document.getElementById('unstakeAmount').value;
    if(!amountStr || parseFloat(amountStr) <= 0) return showToast("Enter valid amount", "error");

    const btn = document.getElementById('btnUnstakeAction');
    const originalText = btn.innerText;

    try {
        btn.disabled = true;
        btn.innerText = "Unstaking...";
        const amountWei = ethers.utils.parseEther(amountStr);

        // Note: Check if your contract uses 'withdraw' or 'unstake'
        const tx = await stakingContract.withdraw(amountWei);
        showToast("Unstake Transaction Sent...", "info");
        await tx.wait();

        showToast("Unstaked Successfully!", "success");
        document.getElementById('unstakeAmount').value = "";
        refreshData();

    } catch (error) {
        console.error(error);
        showToast("Unstake Failed", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// --- CLAIM REWARD FUNCTION ---
async function handleClaim() {
    if(!userAddress) return showToast("Connect Wallet First", "error");

    const btn = document.getElementById('btnClaim');
    
    try {
        btn.disabled = true;
        btn.innerText = "Claiming...";

        const tx = await stakingContract.getReward();
        showToast("Claim Transaction Sent...", "info");
        await tx.wait();

        showToast("Rewards Claimed!", "success");
        refreshData();
    } catch (error) {
        console.error(error);
        showToast("Claim Failed or No Rewards", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Claim Rewards";
    }
}

// ==========================================
// EVENT LISTENERS & NAVIGATION
// ==========================================

document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);

// Staking Actions
const btnStake = document.getElementById('btnStakeAction');
if(btnStake) btnStake.addEventListener('click', handleStake);

const btnUnstake = document.getElementById('btnUnstakeAction');
if(btnUnstake) btnUnstake.addEventListener('click', handleUnstake);

const btnClaim = document.getElementById('btnClaim');
if(btnClaim) btnClaim.addEventListener('click', handleClaim);

// Navigation Logic
function navTo(sectionId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    
    // Highlight sidebar
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        if(link.getAttribute('onclick').includes(sectionId)) {
            link.classList.add('active');
        }
    });

    // Mobile menu close
    document.getElementById('appSidebar').classList.remove('open');
}

function switchStakeTab(mode) {
    const stakeForm = document.getElementById('stakeForm');
    const unstakeForm = document.getElementById('unstakeForm');
    const btns = document.querySelectorAll('.tab-btn');

    if(mode === 'stake') {
        stakeForm.style.display = 'block';
        unstakeForm.style.display = 'none';
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
    } else {
        stakeForm.style.display = 'none';
        unstakeForm.style.display = 'block';
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
    }
}

function setMax(type) {
    if(!userAddress) return showToast("Connect wallet first", "error");
    if(type === 'stake') {
        document.getElementById('stakeAmount').value = balances.vec;
    } else {
        document.getElementById('unstakeAmount').value = balances.staked;
    }
}

// Mobile Menu
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('appSidebar');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        const icon = mobileMenuBtn.querySelector('i');
        if (sidebar.classList.contains('open')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
}

// Helpers
function showToast(msg, type) {
    const box = document.getElementById('messageBox');
    const text = document.getElementById('msgText');
    const icon = document.getElementById('msgIcon');
    
    box.className = `message-box visible ${type}`;
    text.innerText = msg;
    
    if(type === 'success') icon.className = "fas fa-check-circle";
    else if(type === 'error') icon.className = "fas fa-times-circle";
    else icon.className = "fas fa-info-circle";

    setTimeout(() => {
        box.classList.remove('visible');
    }, 3000);
}
