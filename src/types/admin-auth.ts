export type AdminAuthMode = "login" | "setup" | "verify" | "reset";
export type AdminRole = "owner" | "supervisor" | "department_head" | "employee";
export interface AdminProfile 
{ id:string; 
    email:string; 
    username?:string; 
    role:AdminRole;
     passwordConfigured:boolean; }
export interface OtpVerificationInput { email:string; otp:string; purpose:"setup"|"reset"; }


export type usermetadata = {

        id : string;
        is_active : boolean;
        role : AdminRole;
        email : string;
        username : string | null;
        created_at : string;
        updated_at : string;
        auth_user_id : string;
    
}