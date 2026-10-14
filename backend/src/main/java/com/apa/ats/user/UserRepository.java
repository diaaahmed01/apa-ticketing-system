package com.apa.ats.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<AtsUser, Long> {

    Optional<AtsUser> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    @Query("select count(u) > 0 from AtsUser u where lower(u.email) = lower(?1) and (?2 is null or u.id <> ?2)")
    boolean emailTaken(String email, Long exceptId);

    @Query("select distinct u from AtsUser u left join fetch u.roles order by u.fullName")
    List<AtsUser> findAllWithRoles();

    @Query("select count(distinct u) from AtsUser u join u.roles r where r.code = ?1 and u.active = true")
    long countActiveWithRole(String roleCode);
}
