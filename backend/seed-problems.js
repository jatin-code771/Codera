import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

async function seed() {
  try {
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" }
    });

    if (!adminUser) {
      console.log("No ADMIN user found! Run make-admin.js first.");
      return;
    }

    // Adding "Two Sum"
    const problem = await prisma.problem.create({
      data: {
        title: "Two Sum",
        description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.",
        difficulty: "EASY",
        tags: ["Array", "Hash Table"],
        userId: adminUser.id,
        examples: [
          {
            input: "nums = [2,7,11,15], target = 9",
            output: "[0,1]",
            explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
          },
          {
            input: "nums = [3,2,4], target = 6",
            output: "[1,2]"
          }
        ],
        constraints: "- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9\n- -10^9 <= target <= 10^9\n- Only one valid answer exists.",
        hints: "A really brute force way would be to search for all possible pairs of numbers but that would be too slow.\nTry to use a Hash Map to store the elements and their indices.",
        editorial: "Use a hash map to store the values and their indices. For each element x, check if target - x is in the map.",
        testCases: [
          { input: "4\n2 7 11 15\n9", output: "0 1" },
          { input: "3\n3 2 4\n6", output: "1 2" }
        ],
        codeSnippet: {
          "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};",
          "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}",
          "python": "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        ",
          "javascript": "var twoSum = function(nums, target) {\n    \n};"
        },
        referenceSolution: {
          "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int, int> m;\n        for(int i=0; i<nums.size(); i++){\n            if(m.find(target-nums[i]) != m.end()) return {m[target-nums[i]], i};\n            m[nums[i]] = i;\n        }\n        return {};\n    }\n};",
          "javascript": "var twoSum = function(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n};"
        }
      }
    });

    console.log(`Success! Inserted Problem: ${problem.title}`);
  } catch (error) {
    console.error("Error seeding problem:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
