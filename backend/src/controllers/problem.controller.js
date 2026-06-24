import { db } from "../libs/db.js";
import {
  getLanguageId,
  submitBatch,
} from "../libs/judge0.libs.js";

export const createProblem = async (req, res) => {
  const {
    title,
    description,
    difficulty,
    tags,
    examples,
    constraints,
    testcases,
    codeSnippets,
    hints,
    editorial,
    referenceSolutions,
  } = req.body;

  // if (req.user.role !== "ADMIN") {
  //   return res
  //     .status(403)
  //     .json({ message: "You are not allowed to create a problem" });
  // }

  try {
    // Validate required fields
    if (!referenceSolutions || typeof referenceSolutions !== 'object') {
      return res.status(400).json({ error: "Reference solutions are required" });
    }
    if (!testcases || !Array.isArray(testcases) || testcases.length === 0) {
      return res.status(400).json({ error: "Test cases are required" });
    }

    for (const [language, solutionCode] of Object.entries(referenceSolutions)) {
      const languageId = getLanguageId(language);
      if (!languageId) {
        return res
          .status(400)
          .json({ error: `Language ${language} is not supported` });
      }

      const submissions = testcases.map(({ input, output }) => ({
        source_code: solutionCode,
        language_id: languageId,
        stdin: input,
        expected_output: output,
      }));

      // Sandbox API returns results directly — no tokens/polling needed
      const results = await submitBatch(submissions);
      console.log("Result is ....",results);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status.id !== 3) {
          return res.status(400).json({
            error: `Reference solution for ${language} failed on test case ${
              i + 1
            }`,
          });
        }
      }
    }

    const newProblem = await db.problem.create({
      data: {
        title,
        description,
        difficulty,
        tags,
        examples,
        constraints,
        testCases: testcases,
        codeSnippet: codeSnippets,
        hints,
        editorial,
        referenceSolution: referenceSolutions,
        userId: req.user.id,
      },
    });

    return res.status(201).json({
      message: "Problem created successfully",
      data: newProblem,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Error While Creating Problem" });
  }
};


export const getAllProblems= async ( req, res ) =>{


  try {
    const problems= await db.problem.findMany(
      {
        include:{
          solvedBy:{
            where:{
              userId:req.user.id  
        }
      }
    }
  }
    );

    if(!problems){
      return res.status(404).json({
        error:"No Problems Found"
      })
    }
    res.status(200).json({
      message: "message fetched successfully",
      problems,
      success: true,
    })
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Error While fetching Problem" });
  }



}

export const getProblemById = async (req,res)=>{
  const {id} =req.params;

  try {
    const problem = await db.problem.findUnique({
      where:{
        id:id
      }
    })

    if(!problem){
      return res.status(404).json({
        error:"Problem not Found"
      })
    }

    res.status(200).json({
      message: "message fetched successfully",
      problem,
      success: true,
    })
  } 
    catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Error While fetching Problem" });
  }
}


export const deleteProblem = async (req,res)=>{
  const {id} = req.params;

  try {
    const problem = await db.problem.findUnique({
      where:{
        id
      }
    })
    if(!problem){
      return res.status(404).json({
        error:"Problem Not Found"
      })
    }
  
    await db.problem.delete({where:{id}});
    res.status(200).json({
      success:true,
      message:"Problem deleted Successfully"
    })
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Error While deleting Problem" });
  }
}

export const getAllProblemsSolvedByUser = async (req,res)=>{
  try {

    const problems= await db.problem.findMany({
      where :{
      solvedBy:{
        some:{
          userId: req.user.id
        }
      }
    },
    include:{
      solvedBy:{
        where:{
          userId:req.user.id
        }
      }
    }
    })
    
    res.status(200).json({
      success:true,
      message:"Problems fetched Successfully",
      problems
    })

  } catch (error) {
    console.error("Error fetching problems")
    res.status(500).json({
      error:""
    })
  }
}