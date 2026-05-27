import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kuzjqprajfjqvnqechzv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1empxcHJhamZqcXZucWVjaHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDAyMzYsImV4cCI6MjA5NDE3NjIzNn0.7a1-f-MTlO-zYBQiyf6ia3QnpBtDSv6RfoRIR0agDvM'

export const supabase = createClient(supabaseUrl, supabaseKey)