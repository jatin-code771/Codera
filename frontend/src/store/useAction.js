import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useProblemStore } from "./useProblemStore";

export const useActions = create((set)=>({
    isDeletingProblem:false,

    onDeleteProblem:async(id)=>{
        try {
             set({ isDeletingProblem: true });
            const res = await axiosInstance.delete(`/problems/delete-problem/${id}`);
            
            // Remove the problem from the UI immediately
            useProblemStore.setState((state) => ({
              problems: state.problems.filter((p) => p.id !== id)
            }));

            toast.success(res.data.message);
        } catch (error) {
             console.log("Error deleting problem", error);
            toast.error("Error deleting problem");
        }
        finally{
            set({isDeletingProblem:false})
        }
    }
}))