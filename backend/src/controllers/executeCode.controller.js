import {db}  from "../libs/db.js"
import express from "express";
import { getLanguageName, submitBatch } from "../libs/judge0.libs.js";
import { status } from "../generated/prisma/index.js";


export const executeCode = async(req,res)=>{
    console.log("hloo");
 try {
    const { source_code, language_id, stdin, expected_outputs, problemId } =
      req.body;

    const userId = req.user.id;

    // Validate test cases

    if (
      !Array.isArray(stdin) ||
      stdin.length === 0 ||
      !Array.isArray(expected_outputs) ||
      expected_outputs.length !== stdin.length
    ) {
      return res.status(400).json({ error: "Invalid or Missing test cases" });
    }

    // 2. Prepare each test cases for Piston submission
    const submissions = stdin.map((input) => ({
      source_code,
      language_id,
      stdin: input,
    }));

    // 3. Send submissions to Piston (returns results immediately)
    const results = await submitBatch(submissions);

    console.log("Result-------------");
    console.log(results);

// analyze test results

let allPassed=true;

  const detailedResults= results.map((result , i)=>{
  const stdout= result.stdout?.trim();
  const expected_output= expected_outputs[i]?.trim();
  const passed = stdout === expected_output;

    if(!passed) allPassed= false;


    return{
      testCase:i+1,
      passed,
      stdout,
      expected:expected_output,
      stderr:result.stderr || null,
      compile_output: result.compile_output || null,
      status: result.status.description,
      memory: result.memory ? `${result.memory} KB`: undefined,
      time:result.time ? `${result.time} s` : undefined
    
    
    }





//   console.log(`Testcase #${i+1}`);
//  console.log(`Input ${stdin[i]}`)
//  console.log(`expected output for testcase ${expected_output}`)
//  console.log(`actual output ${stdout}`)

//  console.log(`Matched : ${passed}`);
 })

 console.log(detailedResults)
 
//  store submission memory

const submission= await db.submission.create({
  data:{
    userId,
    problemId,
    sourceCode: source_code,
    language: getLanguageName(language_id),
    stdin:stdin.join("\n"),
    status: allPassed ? "Accepted" : "Wrong Answer",
    stdout:JSON.stringify(detailedResults.map((r)=> r.stdout)),
    stderr:detailedResults.some((r)=> r.stderr)
    ? JSON.stringify(detailedResults.map((r)=>r.stderr))
    : null,
    compileOutput:detailedResults.map((r)=> r.compile_output)
    ? JSON.stringify(detailedResults.map((r)=>r.compile_output ))
    : null,
    
  },
});

// if allpassed = true mark problem as solved for the current user 


if(allPassed && problemId){
  await db.problemSolved.upsert({
    where:{
      userId_problemId:{
        userId, problemId
      }
    },
    update:{},
    create:{
      userId, problemId
    }
  })
}

console.log("hiiii");

// 8 Save individual test case results


    const testCaseResults = detailedResults.map((result) => ({
      submissionId: submission.id,
      testCase: result.testCase,
      passed: result.passed,
      stdout: result.stdout,
      expected: result.expected,
      stderr: result.stderr,
      compileOutput: result.compile_output,
      status: result.status,
      memory: result.memory,
      time: result.time,
    }));

    await db.testCaseResult.createMany({
      data: testCaseResults,
    });

    const submissionWithTestCase = await db.submission.findUnique({
      where: {
        id: submission.id,
      },
      include: {
        testCases: true,
      },
    });
   
    res.status(200).json({
      success: true,
      message: "Code Executed! Successfully!",
      submission: submissionWithTestCase,
    });

    }
     catch (error) {
      console.error("Error while handling submission:", error);
  res.status(500).json({ error: "Something went wrong." });
    }
}


