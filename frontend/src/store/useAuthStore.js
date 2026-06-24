import {create} from "zustand"

import {axiosInstance} from "../lib/axios.js"
import { set } from "zod"
import toast from "react-hot-toast"

export const useAuthStore=create((set)=>({
    authUser:null,
    isSigningUp:false,
    isLoading:false,
  isCheckingAuth:false,

checkAuthUser: async ()=>{ 
  set({isCheckingAuth:true})
    try {
        const res=await axiosInstance.get("/auth/check")
        console.log("checkAuthResponse",res.data);
    set({ authUser:res.data.user, isCheckingAuth:false })
    } catch (error) {
        console.log(error);
    set({ authUser:null, isCheckingAuth:false })
    }
},

signup: async (data) => {
  set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/register", data);

      set({ authUser: res.data.user });

      toast.success(res.data.message);
    } catch (error) {
      console.log("Error signing up", error);
      toast.error("Error signing up");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);

      set({ authUser: res.data.user });

      toast.success(res.data.message);
    } catch (error) {
      console.log("Error logging in", error);
      toast.error("Error logging in");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });

      toast.success("Logout successful");
    } catch (error) {
      console.log("Error logging out", error);
      toast.error("Error logging out");
    }
  },

}))

 